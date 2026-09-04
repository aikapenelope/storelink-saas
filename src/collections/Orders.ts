import type {
  CollectionConfig,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  Payload,
  PayloadRequest,
  Where,
} from 'payload';
import { APIError } from 'payload';
import { revalidatePath } from 'next/cache';
import { sql } from '@payloadcms/db-postgres/drizzle';
import { hasTenantAccess } from '@/lib/utils';
import { createTenantWriteGuard } from '@/hooks/ensureTenantMembership';
import { invalidateProductsCache, schedulePostCommitInvalidation } from '@/lib/storefront-cache';
import type { Product } from '@/payload-types';

/**
 * Acceso mínimo tipado al adapter de Postgres (docs/database/postgres#access-
 * to-drizzle): sesiones de drizzle para ejecutar dentro de la transacción del
 * request y tableNameMap para resolver el nombre real de la tabla generada
 * sin hardcodear DDL.
 */
interface PostgresAdapterLike {
  drizzle: { execute: (query: unknown) => Promise<unknown> };
  sessions: Record<
    string,
    { db?: { execute: (query: unknown) => Promise<unknown> } } | undefined
  >;
  tableNameMap: Map<string, string>;
}

export const VARIANTS_TABLE_KEY = 'products_variants';
export const PRODUCTS_TABLE_KEY = 'products';

/** Índice de la variante cuyo SKU coincide; -1 si no hay match. */
export const findVariantIndexBySku = (
  variants: Product['variants'] | null | undefined,
  sku: string | null | undefined,
): number =>
  Array.isArray(variants) ? variants.findIndex((v) => v.sku && v.sku === sku) : -1;

/** Fila física en products_variants: la columna _order es 1-based (i+1). */
export const variantRowNumber = (variantIndex: number): number => variantIndex + 1;

/**
 * Delta ATÓMICO de stock de una variante con validación condicional server-side.
 * UPDATE de fila sobre products_variants (`stock_quantity = stock_quantity + delta`).
 * Si delta < 0 y checkStock === true, la cláusula WHERE exige stock suficiente y RETURNING _order
 * verifica si la fila fue actualizada en la transacción de Postgres.
 */
const applyVariantStockDelta = async ({
  payload,
  req,
  productId,
  variantIndex,
  delta,
  checkStock,
}: {
  payload: Payload;
  req: PayloadRequest;
  productId: number | string;
  variantIndex: number;
  delta: number;
  checkStock?: boolean;
}): Promise<boolean> => {
  const adapter = payload.db as unknown as PostgresAdapterLike;
  const txId = req.transactionID ? await req.transactionID : undefined;
  const executor =
    (txId !== undefined ? adapter.sessions[String(txId)]?.db : undefined) ?? adapter.drizzle;
  const tableName = adapter.tableNameMap.get(VARIANTS_TABLE_KEY) || 'products_variants';

  if (checkStock && delta < 0) {
    const requiredQty = -delta;
    // Auditoría 2026-09-04 (P2): al agotarse el stock por venta, la fila pasa
    // a out_of_stock (antes solo el import CSV lo hacía) — sin esto el
    // catálogo seguía mostrando el producto disponible y el checkout lo
    // rechazaba en el último paso. El ELSE ancla al valor de la columna para
    // que el CASE resuelva al tipo de stock_status (VARCHAR en prod, ENUM en
    // BDs pusheadas) sin cast duro.
    const res = (await executor.execute(sql`
      update ${sql.identifier(tableName)}
      set stock_quantity = stock_quantity + ${delta},
          stock_status = case when (stock_quantity + ${delta}) <= 0 then 'out_of_stock' else stock_status end
      where _parent_id = ${productId}
        and _order = ${variantRowNumber(variantIndex)}
        and (stock_quantity is null or stock_quantity >= ${requiredQty})
      returning _order
    `)) as { rows?: unknown[] };
    return Boolean(res.rows && res.rows.length > 0);
  }

  await executor.execute(sql`
    update ${sql.identifier(tableName)}
    set stock_quantity = stock_quantity + ${delta},
        stock_status = case when ${delta} > 0 then 'in_stock' else stock_status end
    where _parent_id = ${productId} and _order = ${variantRowNumber(variantIndex)}
  `);
  return true;
};

/**
 * Delta ATÓMICO de stock de producto base con validación condicional.
 * Si delta < 0 y checkStock === true, la cláusula WHERE exige stock_quantity >= requiredQty
 * a nivel de motor SQL (bloqueo exclusivo de fila). Si 0 filas se actualizan, retorna false.
 */
const applyBaseProductStockDelta = async ({
  payload,
  req,
  productId,
  delta,
  checkStock,
}: {
  payload: Payload;
  req: PayloadRequest;
  productId: number | string;
  delta: number;
  checkStock?: boolean;
}): Promise<boolean> => {
  const adapter = payload.db as unknown as PostgresAdapterLike;
  const txId = req.transactionID ? await req.transactionID : undefined;
  const executor =
    (txId !== undefined ? adapter.sessions[String(txId)]?.db : undefined) ?? adapter.drizzle;
  const tableName = adapter.tableNameMap.get(PRODUCTS_TABLE_KEY) || 'products';

  if (checkStock && delta < 0) {
    const requiredQty = -delta;
    // Auditoría 2026-09-04 (P2): idem variante — marcar out_of_stock al llegar
    // a cero por venta. `stock_quantity + delta` referencia al valor VIEJO de
    // la fila (semántica UPDATE de Postgres), es decir el nuevo stock.
    const res = (await executor.execute(sql`
      update ${sql.identifier(tableName)}
      set stock_quantity = stock_quantity + ${delta},
          stock_status = case when (stock_quantity + ${delta}) <= 0 then 'out_of_stock' else stock_status end
      where id = ${productId}
        and (track_stock is not true or stock_quantity is null or stock_quantity >= ${requiredQty})
      returning id
    `)) as { rows?: unknown[] };
    return Boolean(res.rows && res.rows.length > 0);
  }

  await executor.execute(sql`
    update ${sql.identifier(tableName)}
    set stock_quantity = stock_quantity + ${delta},
        stock_status = case when ${delta} > 0 then 'in_stock' else stock_status end
    where id = ${productId}
  `);
  return true;
};

/**
 * Reconciliación CRM cancel↔activo (auditoría 2026-09-01 + review Devin #65).
 *
 * GATEADA por CRM_RECONCILIATION_ENABLED. Hoy = true (activada en PR #67
 * tras aplicar la migración de reparación P0-B del schema de Customers,
 * commit c6f95d5/a4609ed): la flag `crmCounted` en orders garantiza que solo
 * se resta un incremento CRM que realmente committeó en el checkout, y el
 * delta usa SOLO columnas reales (total_orders, total_spent, tag) sobre un
 * EJECUTOR AISLADO de la transacción del request (adapter.drizzle, no la
 * sesión de la tx) — así un fallo del CRM no puede abortar el pedido ni la
 * reposición de stock.
 *
 * Historial de la activación (P0-B):
 *   1. Migración de reparación de Customers (drop de preferences/purchase_history
 *      JSONB → columnas aplanadas + tablas + backfill).
 *   2. Track de órdenes contadas en orders (`crmCounted`).
 *   3. CRM_RECONCILIATION_ENABLED = true (estado actual).
 *
 * El tag se recalcula con los MISMOS umbrales de upsertCustomerCrm
 * (orders >= 3 || spent >= 50 → vip; si no frecuente; 0 → inactivo).
 */
const CRM_RECONCILIATION_ENABLED = true;

export const applyCustomerCrmDelta = async ({
  payload,
  tenantId,
  phone,
  totalAmount,
  sign,
}: {
  payload: Payload;
  tenantId: number | string;
  phone: string;
  totalAmount: number;
  /** +1 = pedido (re)activo; -1 = cancelación */
  sign: 1 | -1;
}): Promise<void> => {
  const adapter = payload.db as unknown as PostgresAdapterLike;
  const tableName = adapter.tableNameMap.get('customers') || 'customers';
  const signedTotal = sign * totalAmount;

  // Ejecutor AISLADO (adapter.drizzle = conexión del pool, NO la sesión de la
  // tx del request): si este UPDATE falla, no aborta la transacción del
  // pedido/inventario. Solo toca columnas reales del schema actual.
  await adapter.drizzle.execute(sql`
    update ${sql.identifier(tableName)}
    set total_orders = greatest(coalesce(total_orders, 0) + ${sign}, 0),
        total_spent = greatest(coalesce(total_spent, 0) + ${signedTotal}, 0),
        tag = case
          when coalesce(total_orders, 0) + ${sign} <= 0 then 'inactivo'
          when coalesce(total_orders, 0) + ${sign} >= 3
            or coalesce(total_spent, 0) + ${signedTotal} >= 50 then 'vip'
          else 'frecuente'
        end
    where tenant_id = ${tenantId} and phone = ${phone}
  `);
  // preferences.averageOrderValue NO se recalcula aquí: en el schema real de
  // producción vive dentro del JSONB `preferences` y escribirlo a mano por SQL
  // crudo sobre el JSONB incurre en el riesgo de naming documentado en
  // AGENTS.md. Se recalcula en la migración P0-B (backfill) y en upsertCustomerCrm
  // (que corre vía Local API y pasa por la transformación oficial de Payload).
};

/** Cantidades agregadas por SKU (los ítems sin SKU legacy no son ajustables). */
const qtyBySkuOf = (
  items: Array<{ sku?: string | null; quantity?: number | null }> | null | undefined,
): Map<string, number> => {
  const map = new Map<string, number>();
  for (const item of items ?? []) {
    if (!item.sku) continue;
    const qty = Number(item.quantity) || 0;
    map.set(item.sku, (map.get(item.sku) || 0) + qty);
  }
  return map;
};

/**
 * Resolvedor de productos por SKU compartido por los tres caminos del hook
 * (alta/cancelación/edición): UN solo payload.find para todos los SKUs y
 * mapas O(1), mismo patrón que checkout.ts §verifyAndPriceItems. Items sin
 * SKU (legacy) caen al fallback individual por título.
 */
const fetchProductResolver = async ({
  payload,
  req,
  tenantId,
  items,
}: {
  payload: Payload;
  req: PayloadRequest;
  tenantId: number | string | null | undefined;
  items: Array<{ sku?: string | null; title?: string | null }>;
}): Promise<{
  getProduct: (item: { sku?: string | null; title?: string | null }) => Promise<Product | null>;
}> => {
  const skus = items
    .map((i) => i.sku)
    .filter((s): s is string => typeof s === 'string' && s.length > 0);

  const batchRes = skus.length > 0
    ? await payload.find({
        collection: 'products',
        where: {
          and: [
            ...(tenantId ? [{ tenant: { equals: tenantId } }] : []),
            { or: [{ sku: { in: skus } }, { 'variants.sku': { in: skus } }] },
          ],
        },
        limit: Math.max(skus.length, 1),
        depth: 0,
        overrideAccess: true,
        req,
      })
    : { docs: [] as Product[] };

  const baseBySku = new Map<string, Product>();
  const variantOwnerBySku = new Map<string, Product>();
  for (const p of batchRes.docs as Product[]) {
    if (p.sku && !baseBySku.has(p.sku)) baseBySku.set(p.sku, p);
    for (const v of Array.isArray(p.variants) ? p.variants : []) {
      if (v.sku && !variantOwnerBySku.has(v.sku)) variantOwnerBySku.set(v.sku, p);
    }
  }

  const getProduct = async (
    item: { sku?: string | null; title?: string | null },
  ): Promise<Product | null> => {
    if (item.sku) {
      return baseBySku.get(item.sku) ?? variantOwnerBySku.get(item.sku) ?? null;
    }
    if (!item.title) return null;
    // Fallback: título sin SKU — una query individual (caso legacy infrecuente)
    const whereQuery: Where = {
      and: [
        ...(tenantId ? [{ tenant: { equals: tenantId } }] : []),
        { title: { equals: item.title } },
      ],
    };
    const productRes = await payload.find({
      collection: 'products',
      where: whereQuery,
      limit: 1,
      overrideAccess: true,
      req,
    });
    return (productRes.docs[0] as Product) ?? null;
  };

  return { getProduct };
};

/**
 * Reposición de stock (sin checkStock) compartida por la cancelación y el
 * borrado de órdenes activas. Simétrica a la deducción del alta.
 */
const restoreStockForItems = async ({
  payload,
  req,
  tenantId,
  items,
}: {
  payload: Payload;
  req: PayloadRequest;
  tenantId: number | string | null | undefined;
  items: Array<{ sku?: string | null; title?: string | null; quantity?: number | null }>;
}): Promise<void> => {
  const { getProduct } = await fetchProductResolver({ payload, req, tenantId, items });
  for (const item of items) {
    const prod = await getProduct(item);
    if (!prod) continue;

    const variantIndex = findVariantIndexBySku(prod.variants, item.sku);
    const matchedVariant = variantIndex >= 0 ? prod.variants?.[variantIndex] : undefined;

    if (matchedVariant && typeof matchedVariant.stockQuantity === 'number') {
      const qtyToRestore = Number(item.quantity) || 1;
      await applyVariantStockDelta({
        payload,
        req,
        productId: prod.id,
        variantIndex,
        delta: qtyToRestore,
      });
      continue;
    }

    if (!prod.trackStock || typeof prod.stockQuantity !== 'number') continue;

    const qtyToRestore = Number(item.quantity) || 1;
    await applyBaseProductStockDelta({
      payload,
      req,
      productId: prod.id,
      delta: qtyToRestore,
    });
  }
};

/**
 * Delta de stock por EDICIÓN de ítems de una orden activa (auditoría
 * 2026-09-04, P1): antes, editar la cantidad de una orden no ajustaba stock y
 * la cancelación posterior reponía la cantidad EDITADA (no la deducida
 * original) → deriva de inventario silenciosa en ambas direcciones. Ahora el
 * delta por SKU entre previousDoc.items y doc.items deduce los aumentos (con
 * checkStock: la edición se rechaza si no hay inventario) y repone las
 * disminuciones. Ítems sin SKU (legacy) no son ajustables.
 */
const applyStockDeltasForEdit = async ({
  payload,
  req,
  tenantId,
  previousItems,
  newItems,
}: {
  payload: Payload;
  req: PayloadRequest;
  tenantId: number | string | null | undefined;
  previousItems: Array<{ sku?: string | null; quantity?: number | null }>;
  newItems: Array<{ sku?: string | null; quantity?: number | null }>;
}): Promise<boolean> => {
  const oldQty = qtyBySkuOf(previousItems);
  const newQty = qtyBySkuOf(newItems);

  const deltas: Array<{ sku: string; delta: number }> = [];
  for (const [sku, qty] of newQty) {
    const diff = qty - (oldQty.get(sku) || 0);
    if (diff !== 0) deltas.push({ sku, delta: diff });
  }
  for (const [sku, qty] of oldQty) {
    if (!newQty.has(sku) && qty !== 0) deltas.push({ sku, delta: -qty });
  }
  if (deltas.length === 0) return false;

  const { getProduct } = await fetchProductResolver({
    payload,
    req,
    tenantId,
    items: deltas.map(({ sku }) => ({ sku })),
  });

  for (const { sku, delta } of deltas) {
    const prod = await getProduct({ sku });
    if (!prod) continue;

    const variantIndex = findVariantIndexBySku(prod.variants, sku);
    const matchedVariant = variantIndex >= 0 ? prod.variants?.[variantIndex] : undefined;

    if (matchedVariant && typeof matchedVariant.stockQuantity === 'number') {
      if (delta < 0) {
        const success = await applyVariantStockDelta({
          payload,
          req,
          productId: prod.id,
          variantIndex,
          delta,
          checkStock: true,
        });
        if (!success) {
          throw new APIError(
            `Stock insuficiente para "${matchedVariant.name || prod.title}". No quedan unidades disponibles.`,
            400,
          );
        }
      } else {
        await applyVariantStockDelta({ payload, req, productId: prod.id, variantIndex, delta });
      }
      continue;
    }

    if (!prod.trackStock || typeof prod.stockQuantity !== 'number') continue;

    if (delta < 0) {
      const success = await applyBaseProductStockDelta({
        payload,
        req,
        productId: prod.id,
        delta,
        checkStock: true,
      });
      if (!success) {
        throw new APIError(
          `Stock insuficiente para "${prod.title}". No quedan unidades disponibles.`,
          400,
        );
      }
    } else {
      await applyBaseProductStockDelta({ payload, req, productId: prod.id, delta });
    }
  }

  return true;
};

/**
 * Hook oficial de gestión de inventario en Payload CMS 3.x
 * Se ejecuta automáticamente ante cualquier canal de creación o actualización de pedidos:
 * - Creación de pedido / Activación: resta la cantidad solicitada del stock de los productos de forma atómica.
 * - Cancelación de pedido: repone automáticamente el stock a los productos correspondientes.
 *
 * Sprint 3 (H4) — dos mejoras de performance:
 * 1. Context guard `skipInventoryHook`: actualizaciones internas del job (trelloCardUrl,
 *    emailConfirmationSent) no deben disparar el hook. Sin esta guard, cada pedido
 *    procesado ejecuta el hook 2–3 veces extra con N queries innecesarias.
 *    Patrón oficial: HOOKS.md §Context — "use context flags to prevent hook loops".
 * 2. Batch fetch de productos: se reemplaza el findProduct() por item (N queries
 *    secuenciales) por un único payload.find con sku:{ in: skus } antes del loop.
 *    Mismo patrón que checkout.ts (verifyAndPriceItems). Para items sin SKU
 *    (datos legacy) se mantiene un fallback individual.
 */
const manageOrderInventoryHook: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
  context,
}) => {
  // Sprint 3 — guard de context: si el update proviene del job (Trello/email),
  // saltamos el hook completo. El job pasa context.skipInventoryHook = true
  // en sus actualizaciones parciales para evitar N queries innecesarias.
  // Patrón: HOOKS.md §Context.
  if (context?.skipInventoryHook) return doc;

  // Audit fix A1: el hook participa en la transacción del request vía `req`
  // (patrón oficial: https://payloadcms.com/docs/database/transactions).
  // Si cualquier paso falla, Payload revierte pedido Y descuento de stock
  // como una sola unidad (all-or-nothing).
  const { payload } = req;

  if (!doc?.items || !Array.isArray(doc.items) || doc.items.length === 0) {
    return doc;
  }

  const tenantId = typeof doc.tenant === 'object' ? doc.tenant?.id : doc.tenant;
  const currentStatus = doc.status || 'pending';
  const previousStatus = previousDoc?.status || null;

  // 1. Pedido nuevo activo o reactivado desde cancelado -> Restar inventario
  const isNewlyCreatedActive = operation === 'create' && currentStatus !== 'cancelled';
  const isReactivated = previousStatus === 'cancelled' && currentStatus !== 'cancelled';

  // 2. Pedido cancelado -> Reponer inventario
  const isCancelled = previousStatus && previousStatus !== 'cancelled' && currentStatus === 'cancelled';

  // Si no hay transición de inventario relevante, puede ser una EDICIÓN de
  // ítems (auditoría 2026-09-04, P1): ajustar stock por delta de cantidad.
  // Aumento → deducción con checkStock (rechaza la edición si no hay stock,
  // dentro de la misma tx); disminución → reposición. Si nada cambió, salir
  // sin tocar la BD.
  if (!isNewlyCreatedActive && !isReactivated && !isCancelled) {
    if (operation === 'update') {
      const adjusted = await applyStockDeltasForEdit({
        payload,
        req,
        tenantId,
        previousItems: (previousDoc?.items ?? []) as Array<{
          sku?: string | null;
          quantity?: number | null;
        }>,
        newItems: doc.items as Array<{ sku?: string | null; quantity?: number | null }>,
      });
      if (!adjusted) return doc;
      // Stock ajustado: continuar hasta la invalidación de caché del final
      // del hook (el storefront debe reflejar el nuevo stock).
    } else {
      return doc;
    }
  }

  // Sprint 3 — batch fetch: UN solo payload.find para todos los SKUs del pedido
  // (helper compartido, mismo patrón que checkout.ts §verifyAndPriceItems).
  const { getProduct } = await fetchProductResolver({
    payload,
    req,
    tenantId,
    items: doc.items as Array<{ sku?: string | null; title?: string | null }>,
  });

  if (isNewlyCreatedActive || isReactivated) {
    for (const item of doc.items) {
      const prod = await getProduct(item);
      if (!prod) continue;

      // La venta por SKU de variante descuenta la FILA de la variante
      const variantIndex = findVariantIndexBySku(prod.variants, item.sku);
      const matchedVariant = variantIndex >= 0 ? prod.variants?.[variantIndex] : undefined;

      if (matchedVariant && typeof matchedVariant.stockQuantity === 'number') {
        const qtyToDeduct = Number(item.quantity) || 1;
        const success = await applyVariantStockDelta({
          payload,
          req,
          productId: prod.id,
          variantIndex,
          delta: -qtyToDeduct,
          checkStock: true,
        });
        if (!success) {
          throw new APIError(
            `Stock insuficiente para "${matchedVariant.name || prod.title}". No quedan unidades disponibles.`,
            400,
          );
        }
        continue;
      }

      if (!prod.trackStock || typeof prod.stockQuantity !== 'number') continue;

      const qtyToDeduct = Number(item.quantity) || 1;
      const success = await applyBaseProductStockDelta({
        payload,
        req,
        productId: prod.id,
        delta: -qtyToDeduct,
        checkStock: true,
      });
      if (!success) {
        throw new APIError(
          `Stock insuficiente para "${prod.title}". No quedan unidades disponibles.`,
          400,
        );
      }
    }
  } else if (isCancelled) {
    await restoreStockForItems({
      payload,
      req,
      tenantId,
      items: doc.items as Array<{
        sku?: string | null;
        title?: string | null;
        quantity?: number | null;
      }>,
    });
  }

  // Reconciliación CRM cancel↔activo (review Devin #65 → flag CRM_RECONCILIATION_ENABLED).
  // En CREATE no interviene (upsertCustomerCrm del checkout ya incrementa los
  // contadores vía Local API). Solo transiciones cancel↔activo: cancelación
  // resta (sign -1), reactivación suma (sign +1). El delta usa un EJECUTOR
  // AISLADO de la tx (adapter.drizzle) y SOLO columnas reales → un fallo del
  // CRM nunca aborta el pedido ni la reposición de stock. Best-effort igualmente.
  const customerPhone =
    doc.customer && typeof doc.customer === 'object' ? doc.customer.phone : undefined;
  const totalAmount = Number(doc.totalAmount);
  if (
    CRM_RECONCILIATION_ENABLED &&
    (isCancelled || isReactivated) &&
    tenantId != null &&
    customerPhone &&
    Number.isFinite(totalAmount) &&
    totalAmount > 0 &&
    (doc as unknown as { crmCounted?: boolean }).crmCounted === true
  ) {
    try {
      await applyCustomerCrmDelta({
        payload,
        tenantId,
        phone: customerPhone,
        totalAmount,
        sign: isCancelled ? -1 : 1,
      });
    } catch (crmErr) {
      console.error(
        `[storelink][orders][${doc.id}] reconciliación CRM falló (non-blocking) para estado ${currentStatus}:`,
        crmErr
      );
    }
  }

  // Auditoría final 2026-09-01 (P1) + review Graphify #64: refrescar TODAS las
  // capas de caché del storefront tras cambios de stock:
  //   1. invalidateProductsCache (Redis/memoria): el HTML regenerado leía el
  //      caché viejo vía getCachedProducts.
  //   2. Pass POST-commit (no bloqueante): este hook corre DENTRO de la
  //      transacción; el pass cierra la ventana [invalidate → commit].
  //   3. revalidatePath del tenant (solo cancel/reactivación): el checkout ya
  //      revalida, pero las transiciones hechas desde el admin o desde
  //      /api/orders/[id]/status NO — el HTML ISR quedaba viejo hasta 5 min.
  // Todo es BEST-EFFORT: un fallo de caché/ISR nunca debe abortar el pedido ni
  // el inventario (review Graphify: un throw aquí abriría la tx del checkout
  // como fallida).
  if (tenantId != null && Number.isFinite(Number(tenantId))) {
    try {
      await invalidateProductsCache(Number(tenantId));
      schedulePostCommitInvalidation(req, Number(tenantId));

      if (isCancelled || isReactivated) {
        try {
          const tenantDoc = await payload
            .findByID({
              collection: 'tenants',
              id: Number(tenantId),
              depth: 0,
              overrideAccess: true,
              req,
            })
            .catch(() => null);
          const tenantSlug =
            tenantDoc && typeof tenantDoc === 'object' && 'slug' in tenantDoc
              ? (tenantDoc as { slug?: string }).slug
              : undefined;
          if (tenantSlug) {
            revalidatePath(`/${tenantSlug}`);
          }
        } catch {
          // Non-blocking: el TTL de ISR (300s) acota la obsolescencia si falla.
        }
      }
    } catch (cacheErr) {
      console.error(
        `[storelink][orders][${doc.id}] invalidación de caché del storefront falló (non-blocking):`,
        cacheErr
      );
    }
  }

  return doc;
};

/**
 * Auditoría 2026-09-04 (P1): borrar una orden ACTIVA no reponía el stock —
 * no existía afterDelete y la deducción del alta quedaba permanente (pérdida
 * de inventario irreversible, sin traza). Misma semántica que la cancelación
 * (reposición sin checkStock). afterDelete no tiene transacción de rollback
 * del pedido (ya se borró): los fallos se loguean y quedan en reconciliación
 * manual, sin bloquear el borrado.
 */
const restoreInventoryOnDeleteHook: CollectionAfterDeleteHook = async ({ doc, req }) => {
  if (req.context?.skipInventoryHook) return doc;

  const status = doc?.status || 'pending';
  if (status === 'cancelled') return doc;
  if (!doc?.items || !Array.isArray(doc.items) || doc.items.length === 0) return doc;

  const { payload } = req;
  const tenantId = typeof doc.tenant === 'object' ? doc.tenant?.id : doc.tenant;

  try {
    await restoreStockForItems({
      payload,
      req,
      tenantId,
      items: doc.items as Array<{
        sku?: string | null;
        title?: string | null;
        quantity?: number | null;
      }>,
    });
  } catch (err) {
    console.error(
      `[storelink][orders][${doc.id}] reposición de stock en borrado falló (reconciliar manualmente):`,
      err
    );
  }

  return doc;
};

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'customer', 'totalAmount', 'status', 'createdAt'],
  },
  hooks: {
    // Guard A1: rechaza create/update con tenant ajeno (403) antes de validar
    beforeChange: [createTenantWriteGuard()],
    afterChange: [manageOrderInventoryHook],
    // Auditoría 2026-09-04 (P1): reponer stock al borrar una orden activa.
    afterDelete: [restoreInventoryOnDeleteHook],
  },
  access: {
    // Audit fix: sin tenants asignados no se puede leer/escribir pedidos
    // (antes Boolean(user) dejaba ver TODOS los pedidos de la plataforma)
    read: ({ req: { user } }) => hasTenantAccess(user),
    create: ({ req: { user } }) => hasTenantAccess(user), // Server action usa overrideAccess:true
    update: ({ req: { user } }) => hasTenantAccess(user),
    delete: ({ req: { user } }) => hasTenantAccess(user),
  },
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      label: 'Número de Pedido',
      required: true,
      index: true,
      // Audit fix C4-complemento: sin unique, una colisión de números hacía
      // que /api/orders/[orderNumber] devolviera el pedido de OTRO cliente.
      unique: true,
    },
    {
      name: 'exchangeRateVES',
      type: 'number',
      label: 'Tasa VES Aplicada al Pedido (snapshot)',
      admin: {
        description: 'Tasa Bs/USD con la que se calculó este pedido. Se congela aquí para conciliación, aunque la tasa del tenant cambie después.',
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Estado del Pedido',
      defaultValue: 'pending',
      options: [
        { label: '🟡 Pendiente de Confirmación', value: 'pending' },
        { label: '🔵 Confirmado', value: 'confirmed' },
        { label: '🟠 En Preparación', value: 'preparing' },
        { label: '🟣 En Camino / Delivery', value: 'in_delivery' },
        { label: '🟢 Entregado / Completado', value: 'delivered' },
        { label: '🔴 Cancelado', value: 'cancelled' },
      ],
      required: true,
    },
    {
      name: 'customer',
      type: 'group',
      label: 'Datos del Cliente',
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Nombre Completo',
          required: true,
        },
        {
          name: 'phone',
          type: 'text',
          label: 'Teléfono / WhatsApp',
          required: true,
        },
        {
          name: 'email',
          type: 'email',
          label: 'Correo Electrónico (para el envío de la confirmación)',
          required: true,
        },
        {
          name: 'address',
          type: 'textarea',
          label: 'Dirección de Entrega',
        },
        {
          name: 'paymentMethod',
          type: 'text',
          label: 'Método de Pago Seleccionado',
        },
        {
          name: 'notes',
          type: 'textarea',
          label: 'Notas Adicionales del Cliente',
        },
      ],
    },
    {
      name: 'items',
      type: 'array',
      label: 'Productos del Pedido',
      required: true,
      fields: [
        {
          name: 'sku',
          type: 'text',
          label: 'SKU / Código',
        },
        {
          name: 'title',
          type: 'text',
          label: 'Producto',
          required: true,
        },
        {
          name: 'price',
          type: 'number',
          label: 'Precio Unitario',
          required: true,
        },
        {
          name: 'quantity',
          type: 'number',
          label: 'Cantidad',
          required: true,
        },
        {
          name: 'subtotal',
          type: 'number',
          label: 'Subtotal',
        },
      ],
    },
    {
      name: 'totalAmount',
      type: 'number',
      label: 'Monto Total del Pedido',
      required: true,
    },
    {
      name: 'currency',
      type: 'text',
      label: 'Moneda',
      defaultValue: 'USD',
    },
    {
      name: 'deliveryType',
      type: 'select',
      label: 'Modalidad de Entrega',
      defaultValue: 'delivery',
      options: [
        { label: '🛵 Envío a Domicilio (Delivery)', value: 'delivery' },
        { label: '🛍️ Retiro en Tienda (Pickup)', value: 'pickup' },
      ],
    },
    {
      name: 'deliveryDetails',
      type: 'group',
      label: 'Detalles Estructurados de Entrega / Dirección',
      admin: {
        condition: (data) => data?.deliveryType === 'delivery',
      },
      fields: [
        { name: 'municipality', type: 'text', label: 'Municipio (ej: Chacao, Baruta)' },
        { name: 'residenceZone', type: 'text', label: 'Urbanización / Sector' },
        { name: 'buildingHouse', type: 'text', label: 'Edificio / Casa / Apto / Piso' },
        { name: 'referencePoint', type: 'text', label: 'Punto de Referencia' },
      ],
    },
    {
      name: 'paymentDetails',
      type: 'group',
      label: 'Detalles y Comprobante de Pago',
      fields: [
        {
          name: 'methodKey',
          type: 'select',
          label: 'Método de Pago Utilizado',
          options: [
            { label: '🇻🇪 Pago Móvil', value: 'pago_movil' },
            { label: '🇺🇸 Zelle', value: 'zelle' },
            { label: '🟡 Binance Pay', value: 'binance' },
            { label: '🟣 Zinli', value: 'zinli' },
            { label: '🇵🇦 Banesco Panamá', value: 'banesco_panama' },
            { label: '💵 Efectivo', value: 'cash' },
            { label: '💳 Punto de Venta', value: 'pos' },
          ],
        },
        { name: 'referenceNumber', type: 'text', label: 'Número de Referencia / Comprobante / TXID' },
        { name: 'issuingBank', type: 'text', label: 'Banco Emisor (Pago Móvil)' },
        { name: 'issuingPhone', type: 'text', label: 'Teléfono Emisor (Pago Móvil)' },
        { name: 'senderName', type: 'text', label: 'Nombre del Titular Emisor' },
        { name: 'senderEmail', type: 'email', label: 'Correo Emisor (Zelle / Zinli)' },
        { name: 'binanceSenderId', type: 'text', label: 'Pay ID / Nickname Emisor de Binance' },
        {
          name: 'paymentStatus',
          type: 'select',
          label: 'Estado de Verificación del Pago',
          defaultValue: 'pending_verification',
          options: [
            { label: '🟡 Pendiente de Verificación', value: 'pending_verification' },
            { label: '🟢 Pago Verificado / Conciliado', value: 'verified' },
            { label: '🔴 Pago Rechazado / Inválido', value: 'rejected' },
          ],
        },
      ],
    },
    {
      name: 'crmCounted',
      type: 'checkbox',
      defaultValue: false,
      label: 'CRM Contado',
      admin: {
        description: 'Indica si este pedido ya fue contado en el CRM del cliente (totalOrders/totalSpent). Los pedidos creados fuera del checkout quedan en false.',
        readOnly: true,
      },
    },
    {
      name: 'trelloCardUrl',
      type: 'text',
      label: 'Enlace a la Tarjeta de Trello',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'emailConfirmationSent',
      type: 'checkbox',
      label: 'Confirmación por Correo Enviada',
      defaultValue: false,
      admin: {
        readOnly: true,
        description: 'Indica si el correo de confirmación fue enviado exitosamente al cliente para evitar duplicados en reintentos.',
      },
    },
  ],
};

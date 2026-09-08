import { revalidatePath } from 'next/cache';
import { Redis } from '@upstash/redis';
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  PayloadRequest,
  TextField,
} from 'payload';
import { APIError } from 'payload';
import { hasTenantAccess } from '@/lib/utils';
import { createTenantWriteGuard } from '@/hooks/ensureTenantMembership';
import { ALLOWED_IMAGE_HOST_SUFFIXES, isAllowedImageHostname, normalizeProductImageUrl } from '@/lib/image-hosts';
import { invalidateProductsCache, schedulePostCommitInvalidation } from '@/lib/storefront-cache';
import { describeCatalogLimit, getCatalogLimit } from '@/lib/tenant-plans';

/**
 * Helper compartido (review Devin #64): resuelve el tenant del producto y
 * refresca TODAS las capas de caché del storefront — ISR (revalidatePath) y
 * caché distribuido Redis/memoria (invalidateProductsCache, awaitable). Lo
 * usan afterChange (create/update) y afterDelete: un producto BORRADO también
 * debe desaparecer del catálogo al instante, no al expirar el TTL.
 *
 * Orden deliberado (review Graphify #64): primero se vacía el caché distribuido
 * (await) y DESPUÉS se revalida el ISR — si revalidatePath corriera antes, la
 * regeneración leería el valor viejo de Redis y repoblaría el HTML con datos
 * obsoletos. Además se agenda un pass POST-commit (no bloqueante) que cierra la
 * ventana [invalidate → commit] de las operaciones transaccionales de Payload.
 * Todo es best-effort: un fallo de caché/ISR nunca debe romper el CRUD.
 */
const refreshProductStorefrontCache = async ({
  doc,
  req,
}: {
  doc: Record<string, unknown>;
  req: PayloadRequest;
}): Promise<void> => {
  try {
    let tenantSlug: string | undefined;

    if (
      doc.tenant &&
      typeof doc.tenant === 'object' &&
      'slug' in doc.tenant &&
      typeof (doc.tenant as { slug?: string }).slug === 'string'
    ) {
      tenantSlug = (doc.tenant as { slug: string }).slug;
    } else if (doc.tenant) {
      const tenantId = typeof doc.tenant === 'object' ? (doc.tenant as { id: number | string }).id : doc.tenant;
      const tenantDoc = await req.payload
        .findByID({
          collection: 'tenants',
          id: Number(tenantId),
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => null);

      if (tenantDoc && typeof tenantDoc === 'object' && 'slug' in tenantDoc) {
        tenantSlug = (tenantDoc as { slug?: string }).slug;
      }
    }

    const tenantIdForCache =
      doc.tenant && typeof doc.tenant === 'object'
        ? (doc.tenant as { id?: number | string }).id
        : (doc.tenant as number | string | undefined);

    if (tenantIdForCache == null || !Number.isFinite(Number(tenantIdForCache))) return;

    // 1. Vaciar caché distribuido PRIMERO (await) — ver orden arriba.
    await invalidateProductsCache(Number(tenantIdForCache));

    // 2. Pass post-commit: cierra la carrera de los hooks transaccionales.
    schedulePostCommitInvalidation(req, Number(tenantIdForCache), tenantSlug);

    // 3. Revalidar el ISR del tenant (solo después de haber vaciado Redis).
    if (tenantSlug) {
      try {
        revalidatePath(`/${tenantSlug}`);
      } catch {
        // Non-blocking en entornos fuera de peticiones HTTP de Next.js
      }
    }
  } catch (err) {
    // Best-effort garantizado (review Graphify #64): si inválida/ISR falla
    // inesperadamente, el TTL de Redis/ISR acota la obsolescencia y el CRUD del
    // producto no debe abortar.
    console.error('[storelink][products] refresh de caché del storefront falló (non-blocking):', err);
  }
};

/**
 * Hook afterChange para revalidar el caché ISR del storefront (/[tenantSlug])
 * cuando se crea o edita un producto manualmente en Payload Admin.
 * Si context.skipRevalidate es true (usado en imports masivos o scripts de mantenimiento),
 * se omite para evitar N revalidaciones individuales redundantes.
 */
const revalidateProductStorefront: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (req.context?.skipRevalidate) return doc;

  await refreshProductStorefrontCache({ doc, req });

  return doc;
};

/**
 * Review Devin #64: los productos ELIMINADOS no pasaban por ninguna
 * invalidación — seguían visibles en el storefront hasta expirar el TTL de
 * Redis (180s) y el ISR (300s).
 */
const revalidateProductOnDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  if (req.context?.skipRevalidate) return doc;

  await refreshProductStorefrontCache({ doc, req });

  return doc;
};

/**
 * PR 3 (auditoría 2026-09-07, C4): unicidad de SKU por tenant.
 *
 * `products.sku` no es unique global (multitenant: el mismo SKU puede existir
 * en comercios distintos) y la unicidad de variante no existe a nivel BD.
 * Ante dos productos del MISMO tenant con el mismo SKU (error de captura o
 * import), el pricing del checkout y la deducción de stock resolvían "el
 * primero del find" SIN sort → no determinista: se podía cobrar el stock del
 * producto A mostrando el B. Este hook cierra la fuente: rechaza el create/
 * update que introduzca un SKU (base o de variante) ya usado por OTRO producto
 * del mismo tenant. El sort determinista (checkout.ts + Orders.ts) queda como
 * defensa en profundidad para datos históricos.
 *
 * beforeValidate de colección: corre en TODOS los canales (admin, REST, Local
 * API) antes de la validación de campos, con `req` (participa de la tx del
 * request — patrón oficial transactions.mdx).
 */
const rejectDuplicateSkuPerTenant: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  // Review Devin PR #93 ronda 2 ("Whitespace bypasses SKU uniqueness"): el
  // valor guardado se NORMALIZA (trim) en el boundary — si se almacenara
  // " X " y el chequeo comparara "X", ambos productos convivirían. Patrón
  // oficial beforeValidate: formatear la data antes de la validación.
  if (typeof data?.sku === 'string') {
    data.sku = data.sku.trim();
  }
  if (Array.isArray(data?.variants)) {
    for (const variant of data.variants) {
      if (variant && typeof variant === 'object' && typeof variant.sku === 'string') {
        variant.sku = variant.sku.trim();
      }
    }
  }

  // En updates parciales el payload puede no traer `tenant`: el documento
  // original es la fuente autorizada (el producto no cambia de tenant).
  const dataTenantId = typeof data?.tenant === 'object' ? data?.tenant?.id : data?.tenant;
  const originalTenantId =
    typeof originalDoc?.tenant === 'object' ? originalDoc?.tenant?.id : originalDoc?.tenant;
  const tenantId = dataTenantId ?? originalTenantId;
  if (tenantId == null) return data; // el guard A1 (beforeChange) cubre tenant ausente

  // Review Devin PR #93 ("Partial updates bypass SKU checks"): se valida el
  // PRODUCTO RESULTANTE, no solo los campos enviados — un update parcial que
  // cambia el base debe chocar contra las variantes NO enviadas (y
  // viceversa), y esas viven en originalDoc.
  const dataBase = typeof data?.sku === 'string' && data.sku.trim() ? data.sku.trim() : undefined;
  const effectiveBase =
    dataBase ?? (operation === 'update' && typeof originalDoc?.sku === 'string' && originalDoc.sku.trim()
      ? originalDoc.sku.trim()
      : undefined);

  const incomingVariants: Array<{ sku?: string | null }> = Array.isArray(data?.variants)
    ? (data.variants as Array<{ sku?: string | null }>)
    : operation === 'update'
      ? ((originalDoc?.variants ?? []) as Array<{ sku?: string | null }>)
      : [];
  const effectiveVariants = incomingVariants
    .map((v) => (typeof v?.sku === 'string' ? v.sku.trim() : ''))
    .filter((s) => s.length > 0);

  const allSkus = [effectiveBase, ...effectiveVariants].filter(
    (s): s is string => Boolean(s),
  );
  if (allSkus.length === 0) return data;

  // Un producto no puede repetir SKU consigo mismo (base == variante, dos
  // variantes iguales) — eso también hace no determinista el resolver.
  const seen = new Set<string>();
  for (const sku of allSkus) {
    if (seen.has(sku)) {
      throw new APIError(`El SKU "${sku}" está repetido dentro del mismo producto.`, 400);
    }
    seen.add(sku);
  }

  const ownId = operation === 'update' ? originalDoc?.id : undefined;

  // SKUs ya usados por OTRO producto del tenant — base O variante (review
  // Devin PR #93 "Variant SKUs remain reusable": sin el or de variants.sku,
  // un SKU existente solo como variante quedaba reutilizable).
  const res = await req.payload.find({
    collection: 'products',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { or: [{ sku: { in: allSkus } }, { 'variants.sku': { in: allSkus } }] },
        ...(ownId !== undefined ? [{ id: { not_equals: ownId } }] : []),
      ],
    },
    limit: Math.max(allSkus.length, 1),
    depth: 0,
    overrideAccess: true,
    req,
  });

  if (res.docs.length > 0) {
    const existing = new Map<string, string>();
    for (const doc of res.docs as Array<{ id: number; sku?: string; variants?: Array<{ sku?: string | null }> }>) {
      if (doc.sku) existing.set(doc.sku, doc.sku);
      for (const v of doc.variants ?? []) {
        if (v.sku) existing.set(v.sku, doc.sku ?? v.sku);
      }
    }
    const conflicts = allSkus.filter((s) => existing.has(s));
    if (conflicts.length > 0) {
      throw new APIError(
        `SKU ya existente en este comercio: ${conflicts.join(', ')}. Los códigos deben ser únicos por tienda.`,
        400,
      );
    }
  }

  return data;
};

/**
 * PR 6b (SPEC-20260907-6, auditoría B3): puerta de cupo del plan en la
 * CREACIÓN MANUAL de productos (admin/REST). El import (CSV/Sheets) ya
 * tiene su propia puerta dentro del job (src/jobs/catalog-import.ts), que
 * decide fila por fila con un snapshot exacto bajo lock por tenant; este
 * hook cubre el hueco restante — el admin y la REST API podían crear
 * productos por encima del límite del plan sin ninguna validación.
 *
 * beforeChange de colección: corre en TODOS los canales dentro de la tx del
 * request (patrón oficial transactions.mdx). Solo aplica a `create` —
 * un update de un producto existente nunca consume cupo (misma semántica
 * que el import: los updates de SKUs existentes no gastan cupo).
 *
 * El context.skipCatalogLimitGate lo desactiva para el import y scripts de
 * mantenimiento (que ya cuentan con su propia puerta acotada por tenant).
 *
 * Review Devin #96 hallazgo 5 (atomicidad): dos creates simultáneos en el
 * último cupo podían ambos pasar el count y committear (límite excedido por
 * 1). Serialización por tenant con el MISMO lock Redis del import (SET NX
 * EX, patrón review Devin #84 — reutilizado a propósito, no inventamos
 * infra): con el lock, el conteo del segundo create ve el commit del
 * primero. FAIL-OPEN decidido con el dueño (lib/rate-limit): si Upstash no
 * responde, el gate corre sin serializar (deriva de ±1 posible, cota
 * comercial — documentado). El import usa la misma clave: manual y bulk
 * quedan coordinados bajo UN solo lock por tenant.
 */
const CATALOG_LIMIT_LOCK_TTL_SECONDS = 30; // acota locks huérfanos si una función muere a mitad
const CATALOG_LIMIT_LOCK_WAIT_MS = 4000; // espera máxima por el lock (admin manual, no bulk)

let catalogLimitLockRedis: Redis | null | undefined;

function getCatalogLimitLockRedis(): Redis | null {
  if (catalogLimitLockRedis !== undefined) return catalogLimitLockRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  catalogLimitLockRedis = url && token ? new Redis({ url, token }) : null;
  return catalogLimitLockRedis;
}

const catalogLimitLockKey = (tenantId: number | string): string =>
  `storelink:import-lock:${tenantId}`; // MISMA clave del import (coordinación única)

async function acquireCatalogLimitLock(tenantId: number | string): Promise<() => void> {
  const redis = getCatalogLimitLockRedis();
  // Fail-open: sin Redis, el gate corre sin serializar (deriva ±1 acotada).
  if (!redis) return () => undefined;
  const deadline = Date.now() + CATALOG_LIMIT_LOCK_WAIT_MS;
  let acquired = false;
  try {
    while (Date.now() < deadline) {
      const res = await redis.set(catalogLimitLockKey(tenantId), 'locked', {
        nx: true,
        ex: CATALOG_LIMIT_LOCK_TTL_SECONDS,
      });
      if (res === 'OK') {
        acquired = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  } catch (err) {
    console.warn('[storelink][products] lock de cupo no disponible (fail-open):', err);
    return () => undefined;
  }
  if (!acquired) {
    // Otra operación (import bulk o create manual) sostiene el lock del
    // tenant: no esperar más — el gate corre igual (fail-open acotado).
    return () => undefined;
  }
  return () => {
    void redis.del(catalogLimitLockKey(tenantId)).catch(() => {
      // El TTL acota la vida del lock si el DEL falla.
    });
  };
}

const enforceCatalogLimitOnCreate: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation !== 'create') return data;
  if (req.context?.skipCatalogLimitGate) return data;

  const tenantValue =
    (data as Record<string, unknown> | undefined)?.tenant;
  const tenantId =
    typeof tenantValue === 'object' && tenantValue !== null
      ? (tenantValue as { id?: number | string }).id
      : (tenantValue as number | string | undefined);
  if (tenantId == null) return data; // el guard A1 (beforeChange) cubre tenant ausente

  // Review Devin #96: serializar creates concurrentes del mismo tenant bajo
  // el lock compartido con el import antes de contar.
  const releaseLock = await acquireCatalogLimitLock(tenantId);

  try {
    const tenantDoc = (await req.payload.findByID({
      collection: 'tenants',
      id: Number(tenantId),
      depth: 0,
      overrideAccess: true,
    }).catch(() => null)) as { plan?: string | null } | null;

    const limit = getCatalogLimit(tenantDoc?.plan);

    const countRes = await req.payload.count({
      collection: 'products',
      where: { tenant: { equals: tenantId } },
      overrideAccess: true,
      req,
    });

    if (countRes.totalDocs >= limit) {
      throw new APIError(
        `Límite del plan alcanzado: este comercio ya tiene ${countRes.totalDocs} productos y su plan admite hasta ${limit}. ${describeCatalogLimit(tenantDoc?.plan)}. Elimina productos o actualiza el plan para seguir agregando.`,
        403,
      );
    }

    return data;
  } finally {
    releaseLock();
  }
};

export const Products: CollectionConfig = {
  slug: 'products',
  hooks: {
    // Guard A1: rechaza create/update con tenant ajeno (403) antes de validar
    beforeValidate: [rejectDuplicateSkuPerTenant],
    beforeChange: [createTenantWriteGuard(), enforceCatalogLimitOnCreate],
    afterChange: [revalidateProductStorefront],
    afterDelete: [revalidateProductOnDelete],
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['imageUrls', 'title', 'sku', 'price', 'stockStatus', 'category', 'tenant'],
  },
  access: {
    read: () => true, // Public read so storefront can display items
    // Audit fix: sin tenants asignados no se puede crear/editar/borrar
    // (antes Boolean(user) dejaba operar sobre productos de TODOS los tenants)
    create: ({ req: { user } }) => hasTenantAccess(user),
    update: ({ req: { user } }) => hasTenantAccess(user),
    delete: ({ req: { user } }) => hasTenantAccess(user),
  },
  fields: [
    // Fase 1 (expand): campo principal de imágenes — texto hasMany con validación de URL.
    // La primera URL es la foto del catálogo; las siguientes quedan disponibles para
    // galería en Fase 2. El campo imageUrl (singular) se mantiene en BD hasta la
    // migración contract (Fase 2, PR separado) para no romper datos existentes.
    {
      name: 'imageUrls',
      type: 'text',
      hasMany: true,
      maxRows: 6,
      label: 'Fotos del Producto (URLs)',
      hooks: {
        beforeValidate: [
          ({ value }) => {
            if (!value) return value;
            const rawList = Array.isArray(value) ? value : [value];
            const cleaned = rawList
              .flatMap((item) => (typeof item === 'string' ? item.split(/[,;\n\r]+/) : item))
              .map((u) => (typeof u === 'string' ? normalizeProductImageUrl(u.trim()) : u))
              .filter((u) => typeof u === 'string' && u.length > 0);
            return cleaned.slice(0, 6);
          },
        ],
      },
      validate: (value: string | string[] | null | undefined): string | true => {
        if (!value) return true;
        const rawList = Array.isArray(value) ? value : [value];
        const urls = rawList
          .flatMap((item) => (typeof item === 'string' ? item.split(/[,;\n\r]+/) : item))
          .map((u) => (typeof u === 'string' ? normalizeProductImageUrl(u.trim()) : u))
          .filter((u) => typeof u === 'string' && u.length > 0);

        const invalid = urls.filter((u) => {
          try {
            const parsed = new URL(u);
            return !parsed.protocol.startsWith('http');
          } catch {
            return true;
          }
        });
        if (invalid.length > 0) {
          return `URL(s) inválidas: ${invalid.join(', ')}`;
        }
        // Auditoría final 2026-09-01 (CRÍTICO): solo hosts de la whitelist
        // (src/lib/image-hosts.ts). Un host no listado hace que next/image
        // lance en render y tumbe la tienda entera (500 en SSR).
        const disallowed = urls.filter((u) => {
          try {
            return !isAllowedImageHostname(new URL(u).hostname);
          } catch {
            return true;
          }
        });
        if (disallowed.length > 0) {
          return `Host de imagen no permitido: ${disallowed.join(', ')}. Hosts permitidos: ${ALLOWED_IMAGE_HOST_SUFFIXES.join(', ')} (o sus subdominios).`;
        }
        return true;
      },
      admin: {
        description:
          'Pega una o varias URLs de imagen de hosts permitidos (Unsplash, Cloudflare R2, martes.app, Google, Cloudinary, Imgur, Shopify, Supabase, Vercel). Puedes separar varias URLs por coma o añadirlas fila por fila. La primera es la foto principal.',
        components: {
          Cell: '@/components/admin/ProductImageCell#ProductImageCell',
        },
      },
    } satisfies TextField,
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Nombre del Producto',
    },
    {
      name: 'sku',
      type: 'text',
      required: true,
      // Query caliente del checkout y de imports: se resuelve por
      // tenant + sku por cada item del carrito (skill: index frequently
      // queried fields). La migración la genera pnpm migrate:create.
      index: true,
      label: 'Código SKU Base (ej: PIZ-001)',
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0,
      label: 'Precio Base',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Descripción del Producto / Ingredientes / Detalles',
    },
    {
      // Fase 2 (contract): este campo se dropeará en un PR separado, después
      // de confirmar en producción que imageUrls funciona correctamente.
      // Se oculta del admin (hidden: true) para no confundir al comerciante,
      // pero la columna/tabla en BD se preserva — expand/contract.
      name: 'images',
      type: 'array',
      label: 'Imágenes del Producto',
      admin: { hidden: true },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: false,
        },
      ],
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      label: 'Categoría',
    },
    {
      name: 'stockStatus',
      type: 'select',
      defaultValue: 'in_stock',
      label: 'Estado de Inventario General',
      options: [
        { label: 'Disponible (En Stock)', value: 'in_stock' },
        { label: 'Agotado (Sin Stock)', value: 'out_of_stock' },
      ],
    },
    {
      name: 'trackStock',
      type: 'checkbox',
      label: 'Controlar cantidad exacta de inventario',
      defaultValue: false,
    },
    {
      name: 'stockQuantity',
      type: 'number',
      label: 'Unidades Disponibles en Stock',
      // Con descuento atómico $inc, min:0 impide stocks negativos residuales
      min: 0,
      admin: {
        condition: (data) => Boolean(data?.trackStock),
      },
    },
    {
      name: 'featured',
      type: 'checkbox',
      label: 'Destacar en la parte superior del catálogo',
      defaultValue: false,
    },
    {
      name: 'variants',
      type: 'array',
      label: 'Variantes de Producto (Tallas, Tamaños, Colores)',
      labels: {
        singular: 'Variante',
        plural: 'Variantes',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Nombre de la Variante (ej: Grande, Mediana, Talla L, Negro)',
          required: true,
        },
        {
          name: 'sku',
          type: 'text',
          label: 'SKU Específico',
        },
        {
          name: 'price',
          type: 'number',
          label: 'Precio de esta Variante',
          required: true,
          min: 0,
        },
        {
          name: 'stockQuantity',
          type: 'number',
          label: 'Cantidad en Stock para esta Variante',
          min: 0,
        },
        {
          name: 'stockStatus',
          type: 'select',
          defaultValue: 'in_stock',
          label: 'Disponibilidad de la Variante',
          options: [
            { label: 'Disponible', value: 'in_stock' },
            { label: 'Agotado', value: 'out_of_stock' },
          ],
        },
      ],
    },
    {
      name: 'modifiers',
      type: 'array',
      label: 'Modificadores / Extras Opcionales (ej: Extras de queso, Salsas, Adicionales)',
      labels: {
        singular: 'Grupo de Modificadores',
        plural: 'Grupos de Modificadores',
      },
      fields: [
        {
          name: 'groupName',
          type: 'text',
          label: 'Nombre del Grupo (ej: Elige tu Salsa, Agrega un Extra)',
          required: true,
        },
        {
          name: 'required',
          type: 'checkbox',
          label: 'Obligatorio seleccionar al menos una opción',
          defaultValue: false,
        },
        {
          name: 'options',
          type: 'array',
          label: 'Opciones del Grupo',
          fields: [
            {
              name: 'name',
              type: 'text',
              label: 'Nombre de la Opción (ej: Queso Extra, Salsa Tártara)',
              required: true,
            },
            {
              name: 'priceDelta',
              type: 'number',
              label: 'Costo Adicional (+ $)',
              defaultValue: 0,
              min: 0,
            },
          ],
        },
      ],
    },
  ],
};

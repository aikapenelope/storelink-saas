import type {
  CollectionConfig,
  CollectionAfterChangeHook,
  Payload,
  PayloadRequest,
  Where,
} from 'payload';
import { sql } from '@payloadcms/db-postgres/drizzle';
import { hasTenantAccess } from '@/lib/utils';
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

/** Índice de la variante cuyo SKU coincide; -1 si no hay match. */
export const findVariantIndexBySku = (
  variants: Product['variants'] | null | undefined,
  sku: string | null | undefined,
): number =>
  Array.isArray(variants) ? variants.findIndex((v) => v.sku && v.sku === sku) : -1;

/** Fila física en products_variants: la columna _order es 1-based (i+1). */
export const variantRowNumber = (variantIndex: number): number => variantIndex + 1;

/**
 * Delta ATÓMICO de stock de una variante: UPDATE de fila sobre
 * products_variants (`stock_quantity = stock_quantity + delta` server-side),
 * el mismo espíritu del $inc usado para el producto base. No se usa
 * payload.update/db.updateOne porque el adapter reemplaza el array completo
 * (delete+insert) y reintroduciría la carrera read-modify-write entre
 * pedidos concurrentes de la misma variante. Corre en la transacción del
 * pedido vía la sesión de drizzle (all-or-nothing junto a la orden).
 */
const applyVariantStockDelta = async ({
  payload,
  req,
  productId,
  variantIndex,
  delta,
}: {
  payload: Payload;
  req: PayloadRequest;
  productId: number | string;
  variantIndex: number;
  delta: number;
}): Promise<void> => {
  const adapter = payload.db as unknown as PostgresAdapterLike;
  const txId = req.transactionID ? await req.transactionID : undefined;
  const executor =
    (txId !== undefined ? adapter.sessions[String(txId)]?.db : undefined) ?? adapter.drizzle;
  const tableName = adapter.tableNameMap.get(VARIANTS_TABLE_KEY);
  if (!tableName) return;

  await executor.execute(sql`
    update ${sql.identifier(tableName)}
    set stock_quantity = stock_quantity + ${delta}
    where _parent_id = ${productId} and _order = ${variantRowNumber(variantIndex)}
  `);
};
import { createTenantWriteGuard } from '@/hooks/ensureTenantMembership';

/**
 * Hook oficial de gestión de inventario en Payload CMS 3.x
 * Se ejecuta automáticamente ante cualquier canal de creación o actualización de pedidos:
 * - Creación de pedido / Activación: resta la cantidad solicitada del stock de los productos.
 * - Cancelación de pedido: repone automáticamente el stock a los productos correspondientes.
 */
const manageOrderInventoryHook: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
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

  const findProduct = async (item: { sku?: string | null; title?: string | null }) => {
    if (!item.title && !item.sku) return null;
    const whereQuery: Where = {
      and: [
        ...(tenantId ? [{ tenant: { equals: tenantId } }] : []),
        item.sku ? { sku: { equals: item.sku } } : { title: { equals: item.title } },
      ],
    };
    const productRes = await payload.find({
      collection: 'products',
      where: whereQuery,
      limit: 1,
      overrideAccess: true,
      req,
    });
    return productRes.docs[0] ?? null;
  };

  if (isNewlyCreatedActive || isReactivated) {
    for (const item of doc.items) {
      const prod = await findProduct(item);
      if (!prod) continue;

      // La venta por SKU de variante descuenta la FILA de la variante
      // (misma semántica que valida processOrder: stock numérico en la
      // variante manda sobre el base); el stock del producto base solo se
      // toca cuando la venta NO corresponde a ninguna variante.
      const variantIndex = findVariantIndexBySku(prod.variants, item.sku);
      const matchedVariant = variantIndex >= 0 ? prod.variants?.[variantIndex] : undefined;

      if (matchedVariant && typeof matchedVariant.stockQuantity === 'number') {
        const qtyToDeduct = Number(item.quantity) || 1;
        await applyVariantStockDelta({
          payload,
          req,
          productId: prod.id,
          variantIndex,
          delta: -qtyToDeduct,
        });
        continue;
      }

      if (!prod.trackStock || typeof prod.stockQuantity !== 'number') continue;

      const qtyToDeduct = Number(item.quantity) || 1;
      // Descuento ATÓMICO con el operador $inc nativo de Payload (mismo patrón
      // del plugin oficial @payloadcms/plugin-ecommerce, confirmOrder.ts):
      // se traduce a SQL `stock_quantity + (-qty)` server-side. La validación
      // previa de stock en checkout (processOrder) es la que rechaza la venta;
      // aquí Math.max(0,...) vía min:0 del campo evita negativos residuales.
      await payload.db.updateOne({
        collection: 'products',
        id: prod.id,
        data: {
          stockQuantity: { $inc: -qtyToDeduct },
        },
        req,
      });
    }
  } else if (isCancelled) {
    for (const item of doc.items) {
      const prod = await findProduct(item);
      if (!prod) continue;

      // Reposición simétrica: primero la variante (si la venta fue por
      // variante), si no el stock base. Mismo criterio que el descuento.
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
      // Reposición ATÓMICA con $inc (mismo patrón que el descuento): evita la
      // ventana TOCTOU del read-modify-write entre cancelaciones concurrentes.
      // db.updateOne es de bajo nivel (sin hooks), igual que el descuento.
      await payload.db.updateOne({
        collection: 'products',
        id: prod.id,
        data: {
          stockQuantity: { $inc: qtyToRestore },
          stockStatus: 'in_stock',
        },
        req,
      });
    }
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
      name: 'trelloCardUrl',
      type: 'text',
      label: 'Enlace a la Tarjeta de Trello',
      admin: {
        readOnly: true,
      },
    },
  ],
};

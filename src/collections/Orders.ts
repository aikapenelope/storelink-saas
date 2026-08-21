import type { CollectionConfig, CollectionAfterChangeHook } from 'payload';

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
  req: { payload },
}) => {
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

  if (isNewlyCreatedActive || isReactivated) {
    for (const item of doc.items) {
      if (!item.title && !item.sku) continue;

      const whereQuery: any = {
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
      });

      if (productRes.docs.length > 0) {
        const prod = productRes.docs[0];
        if (prod.trackStock && typeof prod.stockQuantity === 'number') {
          const qtyToDeduct = Number(item.quantity) || 1;
          const newStock = Math.max(0, prod.stockQuantity - qtyToDeduct);
          await payload.update({
            collection: 'products',
            id: prod.id,
            overrideAccess: true,
            data: {
              stockQuantity: newStock,
              stockStatus: newStock <= 0 ? 'out_of_stock' : 'in_stock',
            },
          });
        }
      }
    }
  } else if (isCancelled) {
    for (const item of doc.items) {
      if (!item.title && !item.sku) continue;

      const whereQuery: any = {
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
      });

      if (productRes.docs.length > 0) {
        const prod = productRes.docs[0];
        if (prod.trackStock && typeof prod.stockQuantity === 'number') {
          const qtyToRestore = Number(item.quantity) || 1;
          const newStock = prod.stockQuantity + qtyToRestore;
          await payload.update({
            collection: 'products',
            id: prod.id,
            overrideAccess: true,
            data: {
              stockQuantity: newStock,
              stockStatus: 'in_stock',
            },
          });
        }
      }
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
    afterChange: [manageOrderInventoryHook],
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user), // Allows server action to record customer orders
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      label: 'Número de Pedido',
      required: true,
      index: true,
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

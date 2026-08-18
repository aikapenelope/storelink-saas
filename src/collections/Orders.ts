import type { CollectionConfig } from 'payload';

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'customer', 'totalAmount', 'status', 'createdAt'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (user.role === 'super-admin') return true;
      return {
        tenant: {
          equals: user.tenant,
        },
      };
    },
    create: () => true, // Allows server action to record customer orders
    update: ({ req: { user } }) => {
      if (!user) return false;
      if (user.role === 'super-admin') return true;
      return {
        tenant: {
          equals: user.tenant,
        },
      };
    },
    delete: ({ req: { user } }) => user?.role === 'super-admin',
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
      name: 'trelloCardUrl',
      type: 'text',
      label: 'Enlace a la Tarjeta de Trello',
      admin: {
        readOnly: true,
      },
    },
  ],
};

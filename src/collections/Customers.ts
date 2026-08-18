import type { CollectionConfig } from 'payload';

export const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'phone', 'totalOrders', 'totalSpent', 'lastOrderAt', 'tag'],
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
    create: () => true, // Allows server actions to register or update customer records
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
      name: 'name',
      type: 'text',
      label: 'Nombre del Cliente',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Teléfono / WhatsApp',
      required: true,
      index: true,
    },
    {
      name: 'email',
      type: 'email',
      label: 'Correo Electrónico (Opcional)',
    },
    {
      name: 'tag',
      type: 'select',
      label: 'Segmento del Cliente',
      defaultValue: 'nuevo',
      options: [
        { label: '🟢 Nuevo Cliente', value: 'nuevo' },
        { label: '⭐ Cliente Frecuente', value: 'frecuente' },
        { label: '👑 Cliente VIP', value: 'vip' },
        { label: '⚪ Inactivo', value: 'inactivo' },
      ],
    },
    {
      name: 'totalOrders',
      type: 'number',
      label: 'Total de Pedidos Realizados',
      defaultValue: 1,
    },
    {
      name: 'totalSpent',
      type: 'number',
      label: 'Gasto Total Acumulado ($)',
      defaultValue: 0,
    },
    {
      name: 'lastOrderAt',
      type: 'date',
      label: 'Fecha del Último Pedido',
    },
    {
      name: 'savedAddresses',
      type: 'array',
      label: 'Direcciones Habituales de Entrega',
      fields: [
        {
          name: 'address',
          type: 'text',
          label: 'Dirección',
        },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notas Internas del Comerciante',
    },
  ],
};

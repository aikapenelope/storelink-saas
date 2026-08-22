import type { CollectionConfig } from 'payload';
import { getUserRole, hasTenantAccess } from '@/lib/utils';

export const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'phone', 'totalOrders', 'totalSpent', 'lastOrderAt', 'tag'],
  },
  access: {
    // Audit fix: datos de clientes son privados y tenant-scoped; un usuario
    // sin tenants asignados no puede leer ni escribir sobre el CRM global.
    read: ({ req: { user } }) => hasTenantAccess(user),
    create: ({ req: { user } }) => hasTenantAccess(user), // Server actions usan overrideAccess:true
    update: ({ req: { user } }) => hasTenantAccess(user),
    delete: ({ req: { user } }) => getUserRole(user) === 'super-admin',
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
      labels: {
        singular: 'Dirección Guardada',
        plural: 'Direcciones Guardadas',
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          label: 'Etiqueta (ej: Casa, Oficina, Trabajo)',
        },
        {
          name: 'municipality',
          type: 'text',
          label: 'Municipio',
        },
        {
          name: 'residenceZone',
          type: 'text',
          label: 'Urbanización / Sector',
        },
        {
          name: 'buildingHouse',
          type: 'text',
          label: 'Edificio / Casa / Piso / Apto',
        },
        {
          name: 'referencePoint',
          type: 'text',
          label: 'Punto de Referencia',
        },
        {
          name: 'address',
          type: 'text',
          label: 'Dirección Completa / Resumen',
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

import type { CollectionConfig } from 'payload';
import { getUserRole, hasTenantAccess } from '@/lib/utils';
import { createTenantWriteGuard } from '@/hooks/ensureTenantMembership';

export const Customers: CollectionConfig = {
  slug: 'customers',
  hooks: {
    // Guard A1: rechaza create/update con tenant ajeno (403) antes de validar
    beforeChange: [createTenantWriteGuard()],
    // Hook afterChange para revalidar el caché del admin cuando se actualiza el CRM
    afterChange: [
      async ({ doc, req }) => {
        // Solo revalidar si hay cambios significativos en el CRM
        // para no invalidar el caché en cada actualización menor
        if (req.context?.skipRevalidate) return doc;
        
        // El CRM se usa principalmente en el admin, así que no necesitamos
        // revalidación agresiva del storefront
        return doc;
      },
    ],
  },
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
      admin: {
        // Celda custom: muestra el número + botón de acceso rápido a WhatsApp.
        // El botón abre wa.me con el nombre del cliente pre-cargado en el mensaje.
        // Patrón oficial: COLLECTIONS.md §Custom Cell Components.
        components: {
          Cell: '@/components/admin/CustomerWhatsAppCell#CustomerWhatsAppCell',
        },
      },
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
    {
      name: 'purchaseHistory',
      type: 'array',
      label: 'Historial de Compras',
      admin: {
        description: 'Registro de todos los pedidos del cliente para análisis de patrones y retención.',
      },
      fields: [
        {
          name: 'orderId',
          type: 'relationship',
          relationTo: 'orders',
          label: 'Pedido',
        },
        {
          name: 'amount',
          type: 'number',
          label: 'Monto del Pedido ($)',
        },
        {
          name: 'date',
          type: 'date',
          label: 'Fecha del Pedido',
        },
        {
          name: 'itemsSummary',
          type: 'textarea',
          label: 'Resumen de Productos',
          admin: {
            description: 'Lista de productos comprados en este pedido.',
          },
        },
        {
          name: 'deliveryType',
          type: 'select',
          label: 'Modalidad de Entrega',
          options: [
            { label: '🛵 Delivery', value: 'delivery' },
            { label: '🛍️ Pickup', value: 'pickup' },
          ],
        },
      ],
    },
    {
      name: 'preferences',
      type: 'group',
      label: 'Preferencias del Cliente',
      fields: [
        {
          name: 'preferredPaymentMethod',
          type: 'text',
          label: 'Método de Pago Preferido',
          admin: {
            description: 'Método de pago que el cliente usa más frecuentemente.',
          },
        },
        {
          name: 'preferredDeliveryType',
          type: 'select',
          label: 'Modalidad de Entrega Preferida',
          options: [
            { label: '🛵 Delivery', value: 'delivery' },
            { label: '🛍️ Pickup', value: 'pickup' },
            { label: 'Sin preferencia', value: 'none' },
          ],
        },
        {
          name: 'averageOrderValue',
          type: 'number',
          label: 'Valor Promedio de Pedido ($)',
          admin: {
            description: 'Promedio de gasto por pedido (calculado automáticamente).',
            readOnly: true,
          },
        },
        {
          name: 'preferredCategories',
          type: 'array',
          label: 'Categorías Favoritas',
          fields: [
            {
              name: 'category',
              type: 'text',
              label: 'Categoría',
            },
          ],
        },
      ],
    },
  ],
};

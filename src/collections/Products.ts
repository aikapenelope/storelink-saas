import type { CollectionConfig } from 'payload';
import { hasTenantAccess } from '@/lib/utils';
import { createTenantWriteGuard } from '@/hooks/ensureTenantMembership';

export const Products: CollectionConfig = {
  slug: 'products',
  hooks: {
    // Guard A1: rechaza create/update con tenant ajeno (403) antes de validar
    beforeChange: [createTenantWriteGuard()],
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['imageUrl', 'title', 'sku', 'price', 'stockStatus', 'category', 'tenant'],
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
    {
      name: 'imageUrl',
      type: 'text',
      label: 'Foto',
      admin: {
        description: 'URL directa de la imagen del producto (ej: Unsplash, Cloudinary o Google Drive)',
        components: {
          Cell: '@/components/admin/ProductImageCell#ProductImageCell',
        },
      },
    },
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
      name: 'images',
      type: 'array',
      label: 'Imágenes del Producto',
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

import type { CollectionConfig } from 'payload';
import { hasTenantAccess } from '@/lib/utils';

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'tenant'],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => hasTenantAccess(user),
    update: ({ req: { user } }) => hasTenantAccess(user),
    delete: ({ req: { user } }) => hasTenantAccess(user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Nombre de la Categoría (ej: Pizzas, Bebidas, Ropa)',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      label: 'Identificador (slug)',
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      label: 'Orden de visualización',
    },
  ],
};

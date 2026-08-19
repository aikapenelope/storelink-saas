import type { CollectionConfig } from 'payload';

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'tenant'],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
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

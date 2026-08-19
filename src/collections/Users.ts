import type { CollectionConfig } from 'payload';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role'],
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => (user as any)?.role === 'super-admin',
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => (user as any)?.role === 'super-admin',
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'tenant-admin',
      options: [
        { label: 'Super Admin (Dueño de la Plataforma)', value: 'super-admin' },
        { label: 'Comerciante (Admin de Tienda)', value: 'tenant-admin' },
      ],
    },
  ],
};

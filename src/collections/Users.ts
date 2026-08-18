import type { CollectionConfig } from 'payload';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'tenant'],
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
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      admin: {
        condition: (data) => data?.role === 'tenant-admin',
        description: 'Tienda asignada a este usuario.',
      },
    },
  ],
};

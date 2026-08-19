import type { CollectionConfig } from 'payload';
import { getUserRole } from '@/lib/utils';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role'],
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => getUserRole(user) === 'super-admin',
    update: ({ req: { user }, id }) =>
      getUserRole(user) === 'super-admin' ||
      (typeof (user as { id?: number })?.id === 'number' && (user as { id?: number })?.id === id),
    delete: ({ req: { user } }) => getUserRole(user) === 'super-admin',
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'tenant-admin',
      access: {
        update: ({ req: { user } }) => getUserRole(user) === 'super-admin',
      },
      options: [
        { label: 'Super Admin (Dueño de la Plataforma)', value: 'super-admin' },
        { label: 'Comerciante (Admin de Tienda)', value: 'tenant-admin' },
      ],
    },
  ],
};

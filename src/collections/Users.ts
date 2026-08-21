import type { CollectionConfig } from 'payload';
import { getUserRole } from '@/lib/utils';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 7 * 24 * 60 * 60, // Sesión segura de 7 días
    maxLoginAttempts: 5, // Bloquea la cuenta automáticamente tras 5 intentos fallidos
    lockTime: 10 * 60 * 1000, // Tiempo de bloqueo de 10 minutos contra ataques de fuerza bruta
  },
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

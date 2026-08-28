import type { CollectionConfig } from 'payload';
import { getUserRole } from '@/lib/utils';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 7 * 24 * 60 * 60, // Sesión segura de 7 días
    maxLoginAttempts: 5, // Bloquea la cuenta automáticamente tras 5 intentos fallidos
    lockTime: 10 * 60 * 1000, // Tiempo de bloqueo de 10 minutos contra ataques de fuerza bruta
    // F3 (auditoría P0): cookie Secure en producción evita fuga de sesión por
    // downgrade HTTP puntual. Condicional porque secure:true rompe el login en
    // http://localhost (recomendación literal de docs/authentication/cookies).
    cookies: {
      secure: process.env.NODE_ENV === 'production',
    },
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role'],
  },
  access: {
    // Audit fix: un tenant-admin NO puede enumerar todos los usuarios de la
    // plataforma (emails + roles). Solo super-admin o su propio documento.
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (getUserRole(user) === 'super-admin') return true;
      return { id: { equals: (user as { id?: number }).id } };
    },
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
      // Sprint 1 (C3): saveToJWT: true incluye el campo `role` en el JWT.
      // Sin esto, Payload no puede leer req.user.role desde el token decodificado
      // y hace un findByID a la BD en cada request autenticado para poblar el
      // usuario completo. Con saveToJWT, el role viaja en el token y el access
      // control corre sin consulta adicional — patrón oficial del skill Payload
      // (ACCESS-CONTROL.md §RBAC): "enabling role checks without database lookups".
      saveToJWT: true,
      access: {
        update: ({ req: { user } }) => getUserRole(user) === 'super-admin',
        // Audit fix C3: un tenant-admin no puede crearse con rol super-admin.
        // Patrón oficial field-level create:
        // https://payloadcms.com/docs/access-control/fields#create
        create: ({ req: { user } }) => getUserRole(user) === 'super-admin',
      },
      options: [
        { label: 'Super Admin (Dueño de la Plataforma)', value: 'super-admin' },
        { label: 'Comerciante (Admin de Tienda)', value: 'tenant-admin' },
      ],
    },
  ],
};

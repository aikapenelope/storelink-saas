import path from 'path';
import { fileURLToPath } from 'url';
import { buildConfig, type Plugin } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant';
import { seoPlugin } from '@payloadcms/plugin-seo';
import { s3Storage } from '@payloadcms/storage-s3';
import { resendAdapter } from '@payloadcms/email-resend';
import { es } from '@payloadcms/translations/languages/es';
import { en } from '@payloadcms/translations/languages/en';
import { getUserRole } from './lib/utils';
import sharp from 'sharp';

import { Users } from './collections/Users';
import { Tenants } from './collections/Tenants';
import { Products } from './collections/Products';
import { Categories } from './collections/Categories';
import { Orders } from './collections/Orders';
import { Customers } from './collections/Customers';
import { Media } from './collections/Media';
import { orderJobs } from './jobs/order-created';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const plugins: Plugin[] = [
  multiTenantPlugin({
    collections: {
      products: {},
      categories: {},
      orders: {},
      customers: {},
      media: {},
    },
    userHasAccessToAllTenants: (user) =>
      Boolean(user?.role === 'super-admin'),
    // Audit fix C3: el array `tenants` que este plugin añade a users se guarda
    // en el JWT (saveToJWT: true, comportamiento por defecto del plugin), y
    // todas las rutas del dashboard autorizan con él. Sin esta opción oficial,
    // cualquier tenant-admin podía auto-asignarse otros tenants vía PATCH
    // /api/users/{id} (escalada horizontal). Opciones documentadas en:
    // https://payloadcms.com/docs/plugins/multi-tenant#tenants-array-field
    tenantsArrayField: {
      includeDefaultField: true,
      arrayFieldAccess: {
        read: ({ req: { user } }) => Boolean(user),
        create: ({ req: { user } }) => getUserRole(user as never) === 'super-admin',
        update: ({ req: { user } }) => getUserRole(user as never) === 'super-admin',
      },
      tenantFieldAccess: {
        create: ({ req: { user } }) => getUserRole(user as never) === 'super-admin',
        update: ({ req: { user } }) => getUserRole(user as never) === 'super-admin',
      },
    },
  }),
  seoPlugin({
    collections: ['products', 'tenants'],
    uploadsCollection: 'media',
    generateTitle: ({ doc }: any) => `${doc?.title || doc?.name || 'Flow'} | Catálogo Online Oficial`,
    generateDescription: ({ doc }: any) =>
      doc?.description ||
      doc?.branding?.welcomeMessage ||
      'Catálogo interactivo PWA con pedidos directos por WhatsApp.',
    generateURL: ({ doc }: any) =>
      `${process.env.NEXT_PUBLIC_SITE_URL || 'https://flow.martes.app'}/${doc?.slug || ''}`,
  }),
];

// Cloudflare R2 / AWS S3 Storage
if (
  process.env.R2_ENDPOINT &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET
) {
  plugins.push(
    s3Storage({
      collections: {
        media: {
          generateFileURL: ({ filename, prefix }) => {
            if (process.env.R2_PUBLIC_URL) {
              const baseUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, '');
              return prefix ? `${baseUrl}/${prefix}/${filename}` : `${baseUrl}/${filename}`;
            }
            return `${process.env.NEXT_PUBLIC_SITE_URL || 'https://flow.martes.app'}/api/media/file/${filename}`;
          },
        },
      },
      bucket: process.env.R2_BUCKET,
      config: {
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        forcePathStyle: true,
      },
    })
  );
}

export default buildConfig({
  admin: {
    user: Users.slug,
    components: {
      beforeDashboard: ['@/components/admin/StoreUrlBanner#StoreUrlBanner'],
      views: {
        analytics: {
          Component: '@/components/admin/AnalyticsView#AnalyticsView',
          path: '/analytics',
        },
      },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  i18n: {
    supportedLanguages: {
      es,
      en,
    },
    fallbackLanguage: 'es',
  },
  email: resendAdapter({
    defaultFromAddress: process.env.RESEND_FROM_EMAIL || 'pedidos@flow.martes.app',
    defaultFromName: process.env.RESEND_FROM_NAME || 'Flow Notificaciones',
    apiKey: process.env.RESEND_API_KEY || '', // Empty string: Payload skips email if no key is set
  }),
  // Jobs Queue oficial de Payload 3 (docs/jobs-queue): el checkout encola el
  // workflow `order-created` (Trello + email) y lo procesa al instante con
  // payload.jobs.runByID() dentro de after(). Un runner externo
  // (GitHub Actions → /api/jobs/run, con CRON_SECRET) reintenta fallos.
  jobs: {
    tasks: orderJobs.tasks,
    workflows: orderJobs.workflows,
  },
  sharp: sharp as any,
  collections: [Tenants, Users, Categories, Products, Orders, Customers, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || (() => { throw new Error('PAYLOAD_SECRET env var is required'); })(),
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || process.env.POSTGRES_URL || '',
      max: 10, // Optimal for concurrent RSC (generateMetadata + Page) with Supabase Transaction Pooler (6543)
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      ssl: {
        rejectUnauthorized: false,
      },
    },
    push: false, // Production: use explicit migrations instead of auto-push
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  plugins,
});

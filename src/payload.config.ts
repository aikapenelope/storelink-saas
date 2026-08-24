import path from 'path';
import { fileURLToPath } from 'url';
import { timingSafeEqual } from 'crypto';
import { buildConfig, type Plugin } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant';
import { seoPlugin } from '@payloadcms/plugin-seo';
import { s3Storage } from '@payloadcms/storage-s3';
import { es } from '@payloadcms/translations/languages/es';
import { en } from '@payloadcms/translations/languages/en';
import { resendTenantAdapter } from './lib/email/resend-tenant-adapter';
import { migrations } from './migrations';
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
  // Endurecimiento según docs/production/preventing-abuse.mdx (patrones
  // oficiales de Payload contra abuso en producción):
  // - CORS/CSRF: orígenes permitidos explícitos (serverURL se añade solo
  //   si está definido; se listan igual para dev con localhost).
  // - GraphQL deshabilitado: la app usa REST + Local API únicamente; los
  //   docs recomiendan deshabilitarlo si no se necesita.
  // - maxDepth: default 10 → 5, el mayor uso real en el repo es depth 1.
  cors: [
    process.env.NEXT_PUBLIC_SITE_URL || 'https://flow.martes.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  csrf: [
    process.env.NEXT_PUBLIC_SITE_URL || 'https://flow.martes.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  graphQL: {
    disable: true,
  },
  maxDepth: 5,
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
  email: resendTenantAdapter({
    defaultFromAddress: process.env.RESEND_FROM_EMAIL || 'pedidos@flow.martes.app',
    defaultFromName: process.env.RESEND_FROM_NAME || 'Flow Notificaciones',
    apiKey: process.env.RESEND_API_KEY || '', // Master fallback; por-tenant se resuelve por from
  }),
  // Jobs Queue oficial de Payload 3 (docs/jobs-queue): el checkout encola el
  // workflow `order-created` (Trello + email) y lo procesa al instante con
  // payload.jobs.runByID() dentro de after(). Un runner externo (GitHub
  // Actions → GET /api/payload-jobs/run, con x-cron-secret) reintenta fallos;
  // access.run valida ese secreto sobre el endpoint REST oficial.
  jobs: {
    tasks: orderJobs.tasks,
    workflows: orderJobs.workflows,
    access: {
      run: ({ req }) => {
        const provided = req.headers.get('x-cron-secret');
        if (!provided) return false;
        // Comparación timing-safe (crypto.timingSafeEqual de Node): evita
        // filtrar el secreto por diferencias medibles de tiempo.
        const expected = process.env.CRON_SECRET ?? '';
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        return a.length === b.length && timingSafeEqual(a, b);
      },
    },
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
      // TLS según docs oficiales de Supabase (SSL Enforcement): el modo
      // recomendado es verify-full. Con SUPABASE_CA_CERT (PEM descargable del
      // dashboard: Database Settings → SSL Configuration) se verifica la CA;
      // sin ella se mantiene require (cifrado sin verificación) para no romper
      // entornos donde la var aún no esté configurada.
      ssl: process.env.SUPABASE_CA_CERT
        ? {
            rejectUnauthorized: true,
            ca: process.env.SUPABASE_CA_CERT.replace(/\\n/g, '\n'),
          }
        : {
            rejectUnauthorized: false,
          },
    },
    push: false, // Production: use explicit migrations instead of auto-push
    migrationDir: path.resolve(dirname, 'migrations'),
    // Migraciones automáticas en producción (patrón oficial Payload): el CLI
    // `payload migrate` no puede cargar la config en serverless (richtext-
    // lexical es ESM con top-level await → ERR_REQUIRE_ASYNC_MODULE), así que
    // las pendientes se aplican en el init de Payload en producción.
    prodMigrations: migrations,
  }),
  plugins,
});

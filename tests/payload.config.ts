import path from 'path';
import { fileURLToPath } from 'url';
import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant';
import { seoPlugin } from '@payloadcms/plugin-seo';
import sharp from 'sharp';

import { Users } from '../src/collections/Users';
import { Tenants } from '../src/collections/Tenants';
import { Products } from '../src/collections/Products';
import { Categories } from '../src/collections/Categories';
import { Orders } from '../src/collections/Orders';
import { Customers } from '../src/collections/Customers';
import { Media } from '../src/collections/Media';
import { orderJobs } from '../src/jobs/order-created';
import { getUserRole } from '../src/lib/utils';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Config ligera de Payload para tests (patrón oficial: "test directories
 * contain a lightweight Payload config"). Igual que producción en colecciones,
 * jobs y plugins de negocio; distinto SOLO en lo que no debe tocar el mundo
 * real: BD efímera (TEST_DATABASE_URI, contenedor Postgres de CI) y email por
 * consola (consoleEmailAdapter oficial — cero red). Sin storage-s3, sin
 * prodMigrations y SIN credenciales de producción.
 */
export default buildConfig({
  telemetry: false,
  secret: process.env.PAYLOAD_SECRET || 'test-secret',
  collections: [Tenants, Users, Categories, Products, Orders, Customers, Media],
  editor: lexicalEditor(),
  // Sin adapter de email: modo oficial de Payload para entornos sin email
  // (payload.sendEmail solo registra warning — cero red en tests).
  jobs: {
    tasks: orderJobs.tasks,
    workflows: orderJobs.workflows,
    access: {
      run: () => true,
    },
  },
  sharp: sharp as never,
  typescript: {
    outputFile: path.resolve(dirname, '../payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString:
        process.env.TEST_DATABASE_URI || 'postgres://postgres:postgres@localhost:5432/storelink_test',
      max: 5,
    },
    push: true, // En tests: el esquema se crea solo (nunca toca producción)
    migrationDir: path.resolve(dirname, '../migrations'),
    prodMigrations: undefined,
  }),
  i18n: {
    fallbackLanguage: 'es',
  },
  plugins: [
    multiTenantPlugin({
      collections: {
        products: {},
        categories: {},
        orders: {},
        customers: {},
        media: {},
      },
      userHasAccessToAllTenants: (user) => Boolean((user as { role?: string })?.role === 'super-admin'),
      tenantsArrayField: {
        includeDefaultField: true,
      },
    }),
  ],
});

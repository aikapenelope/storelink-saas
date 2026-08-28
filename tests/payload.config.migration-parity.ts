import path from 'path';
import { fileURLToPath } from 'url';
import { buildConfig, type Plugin } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant';
import { seoPlugin } from '@payloadcms/plugin-seo';
import type { GenerateDescription, GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types';
import sharp from 'sharp';

import { Users } from '../src/collections/Users';
import { Tenants } from '../src/collections/Tenants';
import { Products } from '../src/collections/Products';
import { Categories } from '../src/collections/Categories';
import { Orders } from '../src/collections/Orders';
import { Customers } from '../src/collections/Customers';
import { Media } from '../src/collections/Media';
import { orderJobs } from '../src/jobs/order-created';
import { catalogImportJobs } from '../src/jobs/catalog-import';
import { migrations } from '../src/migrations';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Config de PARIDAD DE MIGRACIONES — usada exclusivamente por
 * tests/int/migration-parity.test.ts.
 *
 * A diferencia de tests/payload.config.ts (push: true, prodMigrations:
 * undefined — el esquema se autogenera desde las colecciones y NUNCA pasa
 * por src/migrations/index.ts), esta config replica el arranque REAL de
 * producción (src/payload.config.ts): push: false + prodMigrations con la
 * lista real de migraciones. Corre contra una base de datos propia y
 * efímera (creada/destruida por el propio test) para no interferir con el
 * resto de la suite, que sigue usando su esquema autogenerado.
 *
 * Objetivo: detectar en CI la clase de bug del incidente P0 del 28-ago-2026
 * (columna de colección sin migración registrada en index.ts) ANTES de que
 * llegue a producción. tests/payload.config.ts no puede detectar esto
 * porque su esquema siempre está "perfecto" por construcción (push: true).
 */

const generateSeoTitle: GenerateTitle = ({ doc }) => {
  const d = doc as { title?: string; name?: string } | undefined;
  return `${d?.title || d?.name || 'Flow'} | Test`;
};
const generateSeoDescription: GenerateDescription = () => 'Test SEO description';
const generateSeoURL: GenerateURL = () => 'https://flow.martes.app/test';

const plugins: Plugin[] = [
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
  // seoPlugin incluido para fidelidad de esquema con producción
  // (src/payload.config.ts): sus campos `meta.*` también son columnas reales
  // que las migraciones deben cubrir.
  seoPlugin({
    collections: ['products', 'tenants'],
    uploadsCollection: 'media',
    generateTitle: generateSeoTitle,
    generateDescription: generateSeoDescription,
    generateURL: generateSeoURL,
  }),
];

export function buildMigrationParityConfig(connectionString: string) {
  return buildConfig({
    telemetry: false,
    secret: process.env.PAYLOAD_SECRET || 'test-secret',
    collections: [Tenants, Users, Categories, Products, Orders, Customers, Media],
    editor: lexicalEditor(),
    // Sin adapter de email: modo oficial de Payload para entornos sin email
    // (payload.sendEmail solo registra warning — cero red en tests).
    jobs: {
      tasks: [...orderJobs.tasks, ...catalogImportJobs.tasks],
      workflows: orderJobs.workflows,
      deleteJobOnComplete: false,
      access: { run: () => true },
    },
    sharp: sharp as never,
    typescript: {
      outputFile: path.resolve(dirname, '../payload-types.ts'),
    },
    db: postgresAdapter({
      pool: {
        connectionString,
        max: 5,
      },
      // A diferencia de tests/payload.config.ts: replica producción de verdad.
      push: false,
      migrationDir: path.resolve(dirname, '../src/migrations'),
      prodMigrations: migrations,
    }),
    i18n: { fallbackLanguage: 'es' },
    plugins,
  });
}

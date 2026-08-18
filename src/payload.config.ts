import { buildConfig, type Plugin } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant';
import { s3Storage } from '@payloadcms/storage-s3';
import path from 'path';
import { fileURLToPath } from 'url';

import { Tenants } from './collections/Tenants';
import { Users } from './collections/Users';
import { Categories } from './collections/Categories';
import { Products } from './collections/Products';
import { Media } from './collections/Media';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const plugins: Plugin[] = [
  multiTenantPlugin({
    collections: {
      products: {},
      categories: {},
    },
    tenantField: {
      access: {
        read: () => true,
        update: () => true,
      },
    },
    userHasAccessToAllTenants: (user) => (user as any)?.role === 'super-admin',
  }),
];

// Configure Cloudflare R2 / S3 storage if environment variables are present
if (process.env.R2_BUCKET && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
  plugins.push(
    s3Storage({
      collections: {
        media: true,
      },
      bucket: process.env.R2_BUCKET,
      config: {
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
        endpoint: process.env.R2_ENDPOINT,
        region: process.env.R2_REGION || 'auto',
      },
    })
  );
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Tenants, Users, Categories, Products, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'SUPER_SECRET_PAYLOAD_KEY_123456789',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || process.env.POSTGRES_URL || '',
      ssl: {
        rejectUnauthorized: false,
      },
    },
  }),
  plugins,
});

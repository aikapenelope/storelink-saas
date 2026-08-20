import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media" 
      ADD COLUMN IF NOT EXISTS "tenant_id" integer REFERENCES "tenants"("id") ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS "media_tenant_idx" ON "media" ("tenant_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "media_tenant_idx";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "tenant_id";
  `);
}

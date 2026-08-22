import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "sheets_sync_url" varchar,
      ADD COLUMN IF NOT EXISTS "sheets_sync_enabled" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "sync_last_status" varchar,
      ADD COLUMN IF NOT EXISTS "sync_last_run_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "sync_last_result" jsonb;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "sheets_sync_url",
      DROP COLUMN IF EXISTS "sheets_sync_enabled",
      DROP COLUMN IF EXISTS "sync_last_status",
      DROP COLUMN IF EXISTS "sync_last_run_at",
      DROP COLUMN IF EXISTS "sync_last_result";
  `);
}

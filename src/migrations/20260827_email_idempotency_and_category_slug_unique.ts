import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // F4: Email idempotency flag on orders to prevent duplicate confirmation emails on task retries
  // F10: Category slug per-tenant unique compound index to avoid category slug collisions
  await db.execute(sql`
    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "email_confirmation_sent" boolean DEFAULT false;

    CREATE UNIQUE INDEX IF NOT EXISTS "categories_tenant_slug_unique"
      ON "categories" ("tenant_id", "slug");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "categories_tenant_slug_unique";
    ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "email_confirmation_sent";
  `);
}

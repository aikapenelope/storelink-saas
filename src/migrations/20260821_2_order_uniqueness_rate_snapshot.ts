import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Audit fix: orderNumber único por plataforma + snapshot de tasa de cambio
  // usada al momento del pedido (conciliación exacta aunque la tasa cambie).
  await db.execute(sql`
    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "exchange_rate_ves" double precision;
    CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_unique_idx" ON "orders" ("order_number");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "orders_order_number_unique_idx";
    ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "exchange_rate_ves";
  `);
}

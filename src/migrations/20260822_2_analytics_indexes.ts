import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

// Índices para las agregaciones SQL del dashboard de analíticas (Sprint 3):
// KPIs y serie de ventas se filtran por tenant + fecha; el conteo de
// pendientes por tenant + status. customers_tenant_idx ya existía.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "orders_tenant_created_idx" ON "orders" ("tenant_id", "created_at" DESC);
    CREATE INDEX IF NOT EXISTS "orders_tenant_status_idx" ON "orders" ("tenant_id", "status");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "orders_tenant_created_idx";
    DROP INDEX IF EXISTS "orders_tenant_status_idx";
  `);
}
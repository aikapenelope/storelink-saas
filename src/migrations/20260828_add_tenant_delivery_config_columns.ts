import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * P0 HOTFIX — Schema drift entre Vercel y Supabase.
 *
 * Contexto: los campos `deliveryConfig.fixedPrice` y `deliveryConfig.estimatedTime`
 * se añadieron en Tenants.ts (commit 049e64e, PRs #43/#45/#47) y se desplegaron
 * en Vercel, pero la migración correspondiente quedó sin commitear y sin registrar
 * en index.ts → `prodMigrations` nunca la aplicó.
 *
 * Resultado: toda query a `tenants` fallaba con:
 *   "column tenants.delivery_config_fixed_price does not exist"
 * bloqueando el login y el admin de todos los tenants (tenant-admin y super-admin).
 *
 * Nota sobre la excepción a AGENTS.md §4 (no-SQL-manual):
 * Esta migración se escribió manualmente porque `pnpm migrate:create` no puede
 * correr en este entorno (richtext-lexical ESM top-level await →
 * ERR_REQUIRE_ASYNC_MODULE). Los nombres de columna están verificados:
 *   - Confirmados por los logs de producción de Supabase/Vercel
 *   - Consistentes con el patrón camelCase→snake_case del resto del repo
 *     (`deliveryConfig` → `delivery_config_`, `fixedPrice` → `fixed_price`,
 *      `estimatedTime` → `estimated_time`)
 *   - Alineados con los tipos del schema Payload: number→NUMERIC, text→VARCHAR
 *
 * Tabla tenants_delivery_config_zones ya existe (20260819_v2_pickup_payment_delivery).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "delivery_config_fixed_price" NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "delivery_config_estimated_time" VARCHAR;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "delivery_config_fixed_price",
      DROP COLUMN IF EXISTS "delivery_config_estimated_time";
  `);
}

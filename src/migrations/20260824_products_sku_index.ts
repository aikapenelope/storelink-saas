import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

// Índice sobre products.sku para la query caliente del checkout y de los
// imports (tenant + sku por cada item del carrito). La columna 'sku' es una
// sola palabra minúscula: sin riesgo del naming trap camelCase→snake_case.
// Escrita a mano siguiendo el precedente 20260822_2/20260822_3 porque
// payload migrate:create no corre en este entorno (ERR_REQUIRE_ASYNC_MODULE).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "products_sku_idx" ON "products" ("sku");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "products_sku_idx";
  `);
}

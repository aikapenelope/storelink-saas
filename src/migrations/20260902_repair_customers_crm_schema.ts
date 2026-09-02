import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

/**
 * P0-B — Reparación del schema de Customers (hallazgo de auditoría 2026-09-01).
 *
 * PROBLEMA: la migración 20260901_2_customers_crm_expansion guardó el grupo
 * `preferences` y el array `purchaseHistory` como columnas JSONB, pero
 * Payload 3.88 aplana los grupos en columnas (preferences_*) y crea tablas
 * separadas para los arrays. Resultado: cualquier op Local API sobre
 * customers falla con "column preferences_preferred_payment_method does not
 * exist" → el CRM del checkout no guarda datos (best-effort lo traga).
 *
 * EXCEPCIÓN a AGENTS.md §no-DDL-manual (mismo patrón que 20260828):
 * `pnpm migrate:create` no puede correr en este entorno (richtext-lexical ESM
 * top-level await → ERR_REQUIRE_ASYNC_MODULE). Los nombres de columnas y
 * tablas están VERIFICADOS EMPÍRICAMENTE contra el schema que Payload genera
 * con push:true (pg_dump de una BD de prueba, no adivinados):
 *   - Columnas aplanadas: preferences_preferred_payment_method (varchar),
 *     preferences_preferred_delivery_type (enum), preferences_average_order_value (numeric)
 *   - Tabla customers_purchase_history: id (varchar PK), _parent_id (int FK→customers.id),
 *     _order (int), order_id_id (int FK→orders.id), amount (numeric), date (timestamptz),
 *     items_summary (varchar), delivery_type (enum)
 *   - Tabla customers_preferences_preferred_categories: id (varchar PK), _parent_id (int FK→customers.id),
 *     _order (int), category (varchar)
 *   - Enums: enum_customers_preferences_preferred_delivery_type (delivery,pickup,none),
 *     enum_customers_purchase_history_delivery_type (delivery,pickup)
 *
 * ORDEN SEGURO: crear enums → renombrar viejas → crear nuevas → backfill → drop viejas.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Crear enums (idempotente)
  await db.execute(sql`DO $$ BEGIN CREATE TYPE "enum_customers_preferences_preferred_delivery_type" AS ENUM ('delivery', 'pickup', 'none'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE "enum_customers_purchase_history_delivery_type" AS ENUM ('delivery', 'pickup'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);

  // 2. Crear columnas aplanadas que Payload espera (ANTES de drop las viejas)
  await db.execute(sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "preferences_preferred_payment_method" VARCHAR, ADD COLUMN IF NOT EXISTS "preferences_preferred_delivery_type" "enum_customers_preferences_preferred_delivery_type", ADD COLUMN IF NOT EXISTS "preferences_average_order_value" NUMERIC;`);

  // 4. Crear tablas hijas que Payload espera
  await db.execute(sql`CREATE TABLE IF NOT EXISTS "customers_purchase_history" ("_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" varchar NOT NULL, "order_id_id" integer, "amount" numeric, "date" timestamptz, "items_summary" varchar, "delivery_type" "enum_customers_purchase_history_delivery_type", CONSTRAINT "customers_purchase_history_pkey" PRIMARY KEY ("id"));`);
  await db.execute(sql`ALTER TABLE "customers_purchase_history" ADD CONSTRAINT "customers_purchase_history_order_id_id_orders_id_fk" FOREIGN KEY ("order_id_id") REFERENCES "orders"("id") ON DELETE SET NULL;`);
  await db.execute(sql`ALTER TABLE "customers_purchase_history" ADD CONSTRAINT "customers_purchase_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "customers"("id") ON DELETE CASCADE;`);

  await db.execute(sql`CREATE TABLE IF NOT EXISTS "customers_preferences_preferred_categories" ("_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" varchar NOT NULL, "category" varchar, CONSTRAINT "customers_preferences_preferred_categories_pkey" PRIMARY KEY ("id"));`);
  await db.execute(sql`ALTER TABLE "customers_preferences_preferred_categories" ADD CONSTRAINT "customers_preferences_preferred_categories_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "customers"("id") ON DELETE CASCADE;`);

  // 5. Backfill: preferences JSONB → columnas aplanadas
  await db.execute(sql`UPDATE "customers" SET "preferences_preferred_payment_method" = "preferences"->>'preferredPaymentMethod', "preferences_preferred_delivery_type" = CASE WHEN "preferences"->>'preferredDeliveryType' = 'delivery' THEN 'delivery'::"enum_customers_preferences_preferred_delivery_type" WHEN "preferences"->>'preferredDeliveryType' = 'pickup' THEN 'pickup'::"enum_customers_preferences_preferred_delivery_type" ELSE 'none'::"enum_customers_preferences_preferred_delivery_type" END, "preferences_average_order_value" = ("preferences"->>'averageOrderValue')::numeric WHERE "preferences" IS NOT NULL AND "preferences" != '{}'::jsonb AND "preferences" ? 'preferredPaymentMethod';`);

  // 6. Backfill: purchase_history JSONB → tabla customers_purchase_history
  await db.execute(sql`INSERT INTO "customers_purchase_history" ("id", "_parent_id", "_order", "order_id_id", "amount", "date", "items_summary", "delivery_type") SELECT md5(random()::text || c.id::text || row_num::text), c."id", row_num::integer, CASE WHEN entry->>'orderId' IS NOT NULL AND entry->>'orderId' != '' THEN (entry->>'orderId')::integer ELSE NULL END, (entry->>'amount')::numeric, CASE WHEN entry->>'date' IS NOT NULL AND entry->>'date' != '' THEN (entry->>'date')::timestamptz ELSE NULL END, entry->>'itemsSummary', CASE WHEN entry->>'deliveryType' = 'delivery' THEN 'delivery'::"enum_customers_purchase_history_delivery_type" WHEN entry->>'deliveryType' = 'pickup' THEN 'pickup'::"enum_customers_purchase_history_delivery_type" ELSE NULL END FROM "customers" c, jsonb_array_elements(c."purchase_history") WITH ORDINALITY AS entries(entry, row_num) WHERE c."purchase_history" IS NOT NULL AND c."purchase_history" != '[]'::jsonb;`);

  // 7. Crear columna crm_counted en orders
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "crm_counted" boolean DEFAULT false;`);

  // 8. Limpiar columnas viejas
  await db.execute(sql`ALTER TABLE "customers" DROP COLUMN IF EXISTS "preferences", DROP COLUMN IF EXISTS "purchase_history";`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // 1. Recrear columnas JSONB legacy con sus defaults originales
  await db.execute(sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "preferences" jsonb DEFAULT '{}'::jsonb;`);
  await db.execute(sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "purchase_history" jsonb DEFAULT '[]'::jsonb;`);

  // 2. Backfill preferences desde columnas aplanadas + tabla de categorías
  await db.execute(sql`UPDATE "customers" SET "preferences" = jsonb_build_object('preferredPaymentMethod', "preferences_preferred_payment_method", 'preferredDeliveryType', "preferences_preferred_delivery_type"::text, 'averageOrderValue', "preferences_average_order_value", 'preferredCategories', COALESCE((SELECT jsonb_agg(jsonb_build_object('category', pc."category") ORDER BY pc."_order") FROM "customers_preferences_preferred_categories" pc WHERE pc."_parent_id" = "customers"."id"), '[]'::jsonb)) WHERE "preferences_preferred_payment_method" IS NOT NULL OR "preferences_preferred_delivery_type" IS NOT NULL OR "preferences_average_order_value" IS NOT NULL OR EXISTS (SELECT 1 FROM "customers_preferences_preferred_categories" pc WHERE pc."_parent_id" = "customers"."id");`);

  // 3. Backfill purchase_history desde la tabla hija
  await db.execute(sql`UPDATE "customers" SET "purchase_history" = COALESCE((SELECT jsonb_agg(jsonb_build_object('orderId', ph."order_id_id", 'amount', ph."amount", 'date', ph."date", 'itemsSummary', ph."items_summary", 'deliveryType', ph."delivery_type"::text) ORDER BY ph."_order") FROM "customers_purchase_history" ph WHERE ph."_parent_id" = "customers"."id"), '[]'::jsonb) WHERE EXISTS (SELECT 1 FROM "customers_purchase_history" ph WHERE ph."_parent_id" = "customers"."id");`);

  // 4. Drop de tablas hijas (FK dependencies)
  await db.execute(sql`DROP TABLE IF EXISTS "customers_purchase_history";`);
  await db.execute(sql`DROP TABLE IF EXISTS "customers_preferences_preferred_categories";`);

  // 5. Drop de columnas aplanadas
  await db.execute(sql`ALTER TABLE "customers" DROP COLUMN IF EXISTS "preferences_preferred_payment_method", DROP COLUMN IF EXISTS "preferences_preferred_delivery_type", DROP COLUMN IF EXISTS "preferences_average_order_value";`);

  // 6. Drop de crm_counted
  await db.execute(sql`ALTER TABLE "orders" DROP COLUMN IF EXISTS "crm_counted";`);

  // 7. Drop de enums
  await db.execute(sql`DROP TYPE IF EXISTS "enum_customers_preferences_preferred_delivery_type";`);
  await db.execute(sql`DROP TYPE IF EXISTS "enum_customers_purchase_history_delivery_type";`);
}

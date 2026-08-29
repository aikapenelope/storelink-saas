import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Sprint imageUrls — Fase 1 (expand): crea la tabla compartida de textos
 * hasMany (`products_texts`) que Payload/Drizzle genera automáticamente para
 * TODOS los campos `text + hasMany: true` de la colección `products`.
 *
 * Arquitectura Payload (verificada en @payloadcms/drizzle dist/schema/build.js):
 * — Todos los campos `text hasMany` de una colección comparten UNA tabla
 *   `{slug}_texts` con una columna `path` discriminadora.
 * — Para `imageUrls` en `products`: path = 'imageUrls'.
 * — NO se crea una tabla separada por campo (ej: `products_image_urls`
 *   no existe — eso sería el patrón de arrays de Payload v2, no v3/Drizzle).
 *
 * El backfill preserva los datos del campo anterior `image_url` (text simple)
 * migrándolos como primera URL (order=1) del nuevo campo `imageUrls`.
 * La columna `image_url` se preserva en esta fase (expand/contract) y
 * se eliminará en un PR separado de contracción (Fase 2).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Crear la tabla compartida de textos hasMany de products
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "products_texts" (
      "id"        serial PRIMARY KEY,
      "order"     integer NOT NULL,
      "parent_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
      "path"      varchar NOT NULL,
      "text"      varchar
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "products_texts_order_parent_idx"
      ON "products_texts" ("order", "parent_id")
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "products_texts_path_idx"
      ON "products_texts" ("path")
  `);

  // Backfill: migrar image_url existente → primera URL de imageUrls
  // WHERE trim para ignorar strings vacíos o solo espacios
  await db.execute(sql`
    INSERT INTO "products_texts" ("order", "parent_id", "path", "text")
    SELECT 1, "id", 'imageUrls', "image_url"
    FROM "products"
    WHERE "image_url" IS NOT NULL
      AND trim("image_url") <> ''
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Invertir el backfill antes de borrar la tabla
  // (restore best-effort: recupera solo la primera URL por producto)
  await db.execute(sql`
    UPDATE "products" p
    SET "image_url" = pt."text"
    FROM "products_texts" pt
    WHERE pt."parent_id" = p."id"
      AND pt."path" = 'imageUrls'
      AND pt."order" = 1
      AND (p."image_url" IS NULL OR trim(p."image_url") = '')
  `);

  await db.execute(sql`DROP TABLE IF EXISTS "products_texts"`);
}

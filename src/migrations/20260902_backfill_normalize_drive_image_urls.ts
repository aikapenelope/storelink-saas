import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Backfill de normalización de URLs históricas de Google Drive (visores/compartir)
 * a URLs canónicas de stream directo en `https://lh3.googleusercontent.com/d/<id>`
 * en `products_texts` (imageUrls) y `products` (legacy image_url).
 *
 * Idempotente: solo afecta filas que contengan 'drive.google.com'.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Normalizar enlaces /file/d/<id> en products_texts (imageUrls)
  await db.execute(sql`
    UPDATE "products_texts"
    SET "text" = 'https://lh3.googleusercontent.com/d/' || (regexp_match("text", 'drive\.google\.com/file/d/([a-zA-Z0-9_-]+)'))[1]
    WHERE "path" = 'imageUrls'
      AND "text" ~ 'drive\.google\.com/file/d/([a-zA-Z0-9_-]+)'
  `);

  // 2. Normalizar enlaces open?id=<id> o uc?id=<id> en products_texts (imageUrls)
  await db.execute(sql`
    UPDATE "products_texts"
    SET "text" = 'https://lh3.googleusercontent.com/d/' || (regexp_match("text", 'drive\.google\.com/.*[?&]id=([a-zA-Z0-9_-]+)'))[1]
    WHERE "path" = 'imageUrls'
      AND "text" ~ 'drive\.google\.com/.*[?&]id=([a-zA-Z0-9_-]+)'
  `);

  // 3. Normalizar enlaces /file/d/<id> en la columna legacy image_url de products
  await db.execute(sql`
    UPDATE "products"
    SET "image_url" = 'https://lh3.googleusercontent.com/d/' || (regexp_match("image_url", 'drive\.google\.com/file/d/([a-zA-Z0-9_-]+)'))[1]
    WHERE "image_url" ~ 'drive\.google\.com/file/d/([a-zA-Z0-9_-]+)'
  `);

  // 4. Normalizar enlaces open?id=<id> o uc?id=<id> en la columna legacy image_url de products
  await db.execute(sql`
    UPDATE "products"
    SET "image_url" = 'https://lh3.googleusercontent.com/d/' || (regexp_match("image_url", 'drive\.google\.com/.*[?&]id=([a-zA-Z0-9_-]+)'))[1]
    WHERE "image_url" ~ 'drive\.google\.com/.*[?&]id=([a-zA-Z0-9_-]+)'
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Los enlaces canónicos normalizados son válidos y directos.
  // No se revierte para evitar reinstaurar URLs que bloquean el storefront.
  void db;
}

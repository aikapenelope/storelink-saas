import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Backfill de normalización de URLs históricas de Google Drive (visores/compartir)
 * a URLs canónicas de stream directo en `https://lh3.googleusercontent.com/d/<id>`
 * en `products_texts` (imageUrls) y `products` (legacy image_url).
 *
 * Idempotente: solo afecta filas que contengan 'drive.google.com'.
 */
/**
 * Patrones regex POSIX (anclados en authority exacta) usados en los UPDATEs SQL.
 * Solo hacen match si el host de la URL es estrictamente drive.google.com,
 * protegiendo URLs proxy o externas que solo contengan el texto como subruta
 * (ej: https://proxy.example/path/drive.google.com/file/d/ABC).
 */
export const DRIVE_FILE_PATH_PATTERN = '^\\s*https?://drive\\.google\\.com/file/d/([a-zA-Z0-9_-]+)';
export const DRIVE_QUERY_ID_PATTERN = '^\\s*https?://drive\\.google\\.com/[^?#]*\\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)';

/**
 * Función pura equivalente al comportamiento SQL de la migración para tests unitarios.
 */
export function applyDriveNormalizationRegex(url: string): string | null {
  const fileMatch = url.match(new RegExp(DRIVE_FILE_PATH_PATTERN));
  if (fileMatch?.[1]) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
  }
  const queryMatch = url.match(new RegExp(DRIVE_QUERY_ID_PATTERN));
  if (queryMatch?.[1]) {
    return `https://lh3.googleusercontent.com/d/${queryMatch[1]}`;
  }
  return null;
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Normalizar enlaces /file/d/<id> en products_texts (imageUrls)
  await db.execute(sql`
    UPDATE "products_texts"
    SET "text" = 'https://lh3.googleusercontent.com/d/' || (regexp_match("text", '^\s*https?://drive\.google\.com/file/d/([a-zA-Z0-9_-]+)'))[1]
    WHERE "path" = 'imageUrls'
      AND "text" ~ '^\s*https?://drive\.google\.com/file/d/([a-zA-Z0-9_-]+)'
  `);

  // 2. Normalizar enlaces open?id=<id> o uc?id=<id> en products_texts (imageUrls)
  await db.execute(sql`
    UPDATE "products_texts"
    SET "text" = 'https://lh3.googleusercontent.com/d/' || (regexp_match("text", '^\s*https?://drive\.google\.com/[^?#]*\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)'))[1]
    WHERE "path" = 'imageUrls'
      AND "text" ~ '^\s*https?://drive\.google\.com/[^?#]*\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)'
  `);

  // 3. Normalizar enlaces /file/d/<id> en la columna legacy image_url de products
  await db.execute(sql`
    UPDATE "products"
    SET "image_url" = 'https://lh3.googleusercontent.com/d/' || (regexp_match("image_url", '^\s*https?://drive\.google\.com/file/d/([a-zA-Z0-9_-]+)'))[1]
    WHERE "image_url" ~ '^\s*https?://drive\.google\.com/file/d/([a-zA-Z0-9_-]+)'
  `);

  // 4. Normalizar enlaces open?id=<id> o uc?id=<id> en la columna legacy image_url de products
  await db.execute(sql`
    UPDATE "products"
    SET "image_url" = 'https://lh3.googleusercontent.com/d/' || (regexp_match("image_url", '^\s*https?://drive\.google\.com/[^?#]*\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)'))[1]
    WHERE "image_url" ~ '^\s*https?://drive\.google\.com/[^?#]*\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)'
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Los enlaces canónicos normalizados son válidos y directos.
  // No se revierte para evitar reinstaurar URLs que bloquean el storefront.
  void db;
}

import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

/**
 * PR 3 (auditoría 2026-09-07, C4 — review Devin #93 rondas 2 y 3).
 *
 * Backfill de normalización de SKUs históricos guardados con padding en los
 * extremos: el hook `rejectDuplicateSkuPerTenant` canonicaliza las escrituras
 * NUEVAS con la semántica de String.prototype.trim, pero un SKU histórico
 * " X " (o con tab/NBSP) no chocaba con el exact-match de "X" — ambos
 * productos podían convivir bajo el mismo SKU efectivo.
 *
 * CANÓNICO: la clase de whitespace es la EXACTA de ECMA-262 \s (misma
 * semántica que el trim() de JavaScript que aplica el hook — review ronda 3
 * "Non-space padding bypasses the backfill": btrim solo quita espacios
 * ordinarios). Sin reemplazos internos ni cambios de caso: el checkout
 * resuelve por coincidencia exacta.
 *
 * PROTECCIONES:
 *  - CONSCIENTE DE COLISIONES: NO trimea una fila si con el valor canónico
 *    aparecería un SKU duplicado dentro del mismo tenant (base↔base,
 *    variante↔variante, variante↔base) — la ambigüedad residual queda acotada
 *    por el sort determinista del resolver.
 *  - WHITESPACE-ONLY: NO trimea si el resultado canónico sería '' (review
 *    ronda 3 "Whitespace-only SKUs become unusable") — ese producto queda con
 *    su valor crudo, igual de inerte que antes, sin quedar peor.
 *  - IDEMPOTENTE: las filas ya canónicas no cumplen `sku <> js_trim(sku)`.
 */

/** Clase de whitespace EXACTA de ECMA-262 \s (String.prototype.trim). */
const JS_TRIM_CLASS =
  '[ \\t\\n\\v\\f\\r\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]';

/** Expresión SQL equivalente a String.prototype.trim(columna). */
const jsTrim = (column: string): string =>
  `regexp_replace(${column}, '^${JS_TRIM_CLASS}+|${JS_TRIM_CLASS}+$', '', 'g')`;

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. SKU base de productos: trim solo si el valor canónico no existe ya en
  // OTRO producto del mismo tenant, y el canónico no es vacío.
  await db.execute(sql`
    UPDATE "products" p
    SET "sku" = ${sql.raw(jsTrim('p."sku"'))}
    WHERE p."sku" <> ${sql.raw(jsTrim('p."sku"'))}
      AND ${sql.raw(jsTrim('p."sku"'))} <> ''
      AND NOT EXISTS (
        SELECT 1 FROM "products" q
        WHERE q."id" <> p."id"
          AND q."tenant_id" = p."tenant_id"
          AND ${sql.raw(jsTrim('q."sku"'))} = ${sql.raw(jsTrim('p."sku"'))}
      )
  `);

  // 2. SKU de variantes: trim solo si el valor canónico no existe ya en otra
  // variante del mismo producto, en otra variante del tenant, ni en el SKU
  // base de otro producto del tenant; y el canónico no es vacío.
  await db.execute(sql`
    UPDATE "products_variants" v
    SET "sku" = ${sql.raw(jsTrim('v."sku"'))}
    FROM "products" vp
    WHERE v."_parent_id" = vp."id"
      AND v."sku" IS NOT NULL
      AND v."sku" <> ${sql.raw(jsTrim('v."sku"'))}
      AND ${sql.raw(jsTrim('v."sku"'))} <> ''
      AND NOT EXISTS (
        SELECT 1 FROM "products_variants" w
        WHERE w."id" <> v."id"
          AND w."_parent_id" = v."_parent_id"
          AND ${sql.raw(jsTrim('w."sku"'))} = ${sql.raw(jsTrim('v."sku"'))}
      )
      AND NOT EXISTS (
        SELECT 1 FROM "products_variants" w2
        JOIN "products" wp2 ON wp2."id" = w2."_parent_id"
        WHERE w2."_parent_id" <> v."_parent_id"
          AND wp2."tenant_id" = vp."tenant_id"
          AND ${sql.raw(jsTrim('w2."sku"'))} = ${sql.raw(jsTrim('v."sku"'))}
      )
      AND NOT EXISTS (
        SELECT 1 FROM "products" bp
        WHERE bp."id" <> v."_parent_id"
          AND bp."tenant_id" = vp."tenant_id"
          AND ${sql.raw(jsTrim('bp."sku"'))} = ${sql.raw(jsTrim('v."sku"'))}
      )
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // La canonicidad es irreversible por diseño: reinstalar el padding original
  // no es posible ni deseable (los SKUs canónicos son la forma que el hook de
  // unicidad exige).
  void db;
}

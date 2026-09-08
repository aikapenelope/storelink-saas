import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres';

/**
 * PR 3 (auditoría 2026-09-07, C4 — review Devin #93 ronda 2
 * "Historical padded SKUs remain duplicateable").
 *
 * Backfill de normalización de SKUs históricos guardados con espacios en los
 * extremos: el hook `rejectDuplicateSkuPerTenant` trimea las escrituras NUEVAS,
 * pero un SKU histórico " X " no chocaba con el exact-match de "X" — ambos
 * productos podían convivir bajo el mismo SKU efectivo.
 *
 * CANÓNICO: btrim (espacios a ambos lados). Sin reemplazos internos ni
 * cambios de caso: el checkout resuelve por coincidencia exacta.
 *
 * CONSCIENTE DE COLISIONES: NO trimea una fila si con el trim aparecería un
 * SKU efectivo duplicado dentro del mismo tenant (base↔base, variante↔variante,
 * variante↔base) — esas filas se dejan con su valor crudo (la ambigüedad
 * histórica ya está acotada por el sort determinista `sort: 'id'` del
 * resolver). Idempotente: las filas ya trimadas no cumplen `sku <> btrim(sku)`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. SKU base de productos: trim solo si el valor canónico no existe ya en
  // OTRO producto del mismo tenant.
  await db.execute(sql`
    UPDATE "products" p
    SET "sku" = btrim(p."sku")
    WHERE p."sku" <> btrim(p."sku")
      AND NOT EXISTS (
        SELECT 1 FROM "products" q
        WHERE q."id" <> p."id"
          AND q."tenant_id" = p."tenant_id"
          AND btrim(q."sku") = btrim(p."sku")
      )
  `);

  // 2. SKU de variantes: trim solo si el valor canónico no existe ya en otra
  // variante del mismo producto, en otra variante del tenant, ni en el SKU
  // base de otro producto del tenant.
  await db.execute(sql`
    UPDATE "products_variants" v
    SET "sku" = btrim(v."sku")
    FROM "products" vp
    WHERE v."_parent_id" = vp."id"
      AND v."sku" IS NOT NULL
      AND v."sku" <> btrim(v."sku")
      AND NOT EXISTS (
        SELECT 1 FROM "products_variants" w
        WHERE w."id" <> v."id"
          AND w."_parent_id" = v."_parent_id"
          AND btrim(w."sku") = btrim(v."sku")
      )
      AND NOT EXISTS (
        SELECT 1 FROM "products_variants" w2
        JOIN "products" wp2 ON wp2."id" = w2."_parent_id"
        WHERE w2."_parent_id" <> v."_parent_id"
          AND wp2."tenant_id" = vp."tenant_id"
          AND btrim(w2."sku") = btrim(v."sku")
      )
      AND NOT EXISTS (
        SELECT 1 FROM "products" bp
        WHERE bp."id" <> v."_parent_id"
          AND bp."tenant_id" = vp."tenant_id"
          AND btrim(bp."sku") = btrim(v."sku")
      )
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // La canonicidad es irreversible por diseño: reinstalar los espacios
  // originales no es posible ni deseable (los SKUs trimados son la forma
  // canónica que el hook de unicidad exige).
  void db;
}

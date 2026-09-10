import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * PR 3.5 (plan sprints 2026-09-09, re-triaje ↑P2/V7) — índices FK de
 * junction tables.
 *
 * HALLAZGO: advisors de Supabase señalan 4 FKs sin índice en producción
 * (verificado por MCP): los CASCADE de deletes hacen seq scans a volumen
 * CRM. La BD local con push:true SÍ los genera (divergencia local↔prod que
 * ciega CI).
 *
 * ALCANCE: SOLO los 3 índices que el SCHEMA RUNTIME define (nombres
 * EXACTOS verificados contra el snapshot del baseline — PR 3.2 — y la BD
 * de test con push:true):
 *  - customers_purchase_history_parent_id_idx      (_parent_id)
 *  - customers_purchase_history_order_id_idx      (order_id_id)
 *  - customers_preferences_preferred_categories_parent_id_idx (_parent_id)
 *
 * EL 4º FK DEL ADVISOR (products_texts.parent_id) QUEDA FUERA a propósito:
 * el schema runtime NO define un índice suelto de parent_id para
 * products_texts (solo el compuesto "order,parent_id", que no lidera con
 * parent_id y por eso el advisor lo ignora). Crearlo con SQL suelto
 * fabricaría drift: el próximo migrate:create contra el snapshot del
 * baseline generaría su DROP INDEX. Cierre correcto (backlog): añadir el
 * índice al schema (drizzle custom index en la config) para que el runtime
 * lo defina, y la migración lo genere. Mientras tanto: volumen actual
 * <10k filas — el seq scan de los CASCADE es irrelevante (trade medido,
 * no suposición).
 *
 * TRADE CREATE INDEX CONCURRENTLY (constitución §4): IF NOT EXISTS SIN
 * CONCURRENTLY, documentado — (a) volumen <10k filas (lock momentáneo
 * irrelevante), (b) CONCURRENTLY no puede correr dentro de la transacción
 * BEGIN/COMMIT que db-postgres envuelve por migración ("cannot run inside
 * a transaction block"), y el flujo de emergencia por SQL Editor comparte
 * el mismo bloqueo del runner. Si una tabla supera ~100k filas: recrear
 * por SQL Editor con CONCURRENTLY; el IF NOT EXISTS mantiene esta
 * migración como no-op.
 *
 * ORDEN DE CADENA: guard de existencia de tablas — si aún no existen (BD
 * vacía antes del baseline), no-op (el baseline los incluye en su CREATE,
 * mismo snapshot). Producción: tablas existen → aplica los 3.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Idempotencia (review Devin #114, flag 1 «Production deploy cannot
  //    start»): si los 3 índices ya existen → no-op ANTES de la guardia
  //    anti-pooler. En producción el operador aplica el DDL por conexión
  //    directa y registra la fila; al arrancar, prodMigrations ve los índices
  //    presentes y NO lanza por el pooler (mismo orden que
  //    20260909_jobs_stats_schema: idempotencia primero, pooler después).
  const check = await db.execute(sql`
    SELECT count(*) AS present FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'customers_purchase_history_parent_id_idx',
        'customers_purchase_history_order_id_idx',
        'customers_preferences_preferred_categories_parent_id_idx'
      )
  `);
  const row = (check as unknown as { rows?: Array<{ present?: string | number }> })?.rows?.[0];
  if (Number(row?.present) >= 3) {
    return;
  }

  // 2. Guardia anti-pooler: DDL pendiente + Transaction Pooler → bloquear.
  const connStr = process.env.DATABASE_URI || process.env.POSTGRES_URL || '';
  const isTransactionPooler = connStr.includes(':6543') || connStr.includes('pooler.supabase.com');

  if (isTransactionPooler) {
    throw new Error(
      '[BLOCKED_TRANSACTION_POOLER_DDL] La migración "20260909_fk_junction_indexes" contiene DDL (CREATE INDEX) pendiente y no puede ejecutarse a través del Transaction Pooler de Supabase (puerto 6543). Aplicar por conexión directa (puerto 5432 o Supabase SQL Editor) y registrar la fila en payload_migrations ANTES del deploy. Ver docs/AGENTS_CONSTITUTION.md §Migraciones.'
    );
  }

  // 3. Conexión directa: los 3 índices del schema runtime (nombres exactos).
  //    Guard per-tabla con to_regclass (review Devin #114, flag 2 «Partial
  //    schemas permanently skip indexes»): si una junction table aún no existe
  //    (BD parcial antes del baseline), las demás SÍ se indexan — ya no es
  //    todo-o-nada como el guard anterior de conteo de tablas. CREATE INDEX es
  //    comando de utilidad: dentro del DO se ejecuta vía EXECUTE (mismo patrón
  //    que las migraciones RLS 20260908/20260909).
  await db.execute(sql`
    DO $$
    BEGIN
      IF to_regclass('public.customers_purchase_history') IS NOT NULL THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS "customers_purchase_history_parent_id_idx" ON "customers_purchase_history" ("_parent_id")';
        EXECUTE 'CREATE INDEX IF NOT EXISTS "customers_purchase_history_order_id_idx" ON "customers_purchase_history" ("order_id_id")';
      END IF;
      IF to_regclass('public.customers_preferences_preferred_categories') IS NOT NULL THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS "customers_preferences_preferred_categories_parent_id_idx" ON "customers_preferences_preferred_categories" ("_parent_id")';
      END IF;
    END $$;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Guardia simétrica anti-pooler.
  const connStr = process.env.DATABASE_URI || process.env.POSTGRES_URL || '';
  const isTransactionPooler = connStr.includes(':6543') || connStr.includes('pooler.supabase.com');

  if (isTransactionPooler) {
    throw new Error(
      '[BLOCKED_TRANSACTION_POOLER_DDL] El rollback de los índices FK no puede ejecutarse a través del Transaction Pooler de Supabase (puerto 6543).'
    );
  }

  // Integridad de schema (review Devin #114, flag 3 «Rollback removes
  // pre-existing indexes»): los 3 índices los define el schema runtime (el
  // adaptador drizzle los genera en push:true y el baseline los incluye en su
  // CREATE), NO esta migración — esta solo los backfillea en producción donde
  // faltan. Dropearlos en un rollback eliminaría estado definido por el schema
  // → drift (el próximo push/migrate los regeneraría y en una BD del baseline
  // rompería su snapshot). Por eso el down() es un NO-OP deliberado (mismo
  // criterio que 20260909_rls_all_public_tables).
  await db.execute(sql`SELECT 1`);
}

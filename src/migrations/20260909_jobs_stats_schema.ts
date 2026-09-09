import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * PR 1.1 (plan de sprints 2026-09-09, Sprint 1) — cierre del P0 N1 de la
 * auditoría 2026-09-09: schema drift de jobs.stats.
 *
 * ORIGEN DEL DRIFT: el task `reconcileDispatchOrders` (fix B1, auditoría
 * 09-07) declara `schedule` → el core de Payload 3.88 activa
 * `jobs.scheduling` + `jobs.stats` (config/sanitize.js:284) y añade a la
 * colección interna `payload-jobs` el campo `meta` jsonb
 * (queues/config/collection.js:266-273) + el global `payload-jobs-stats`
 * (tabla `payload_jobs_stats`). Ese DDL es DIRECCIÓN OFICIAL del core
 * (payloadcms/payload#17504: "stats always added whenever jobs are enabled"),
 * no deuda nuestra — la solución correcta es migrarlo, no quitar el schedule.
 * Producción quedó sin ninguno de los dos (verificado por Supabase MCP:
 * payload_jobs = 13 columnas sin `meta`, 0 tablas jobs_stats) y el runner
 * (/api/payload-jobs/run) en 500 desde el deploy del 09-09 porque
 * handleSchedules consulta el global inexistente.
 *
 * GENERACIÓN: up()/down() del DDL central generado 100% por el core vía
 * payload.db.createMigration (misma API que `payload migrate:create`, que no
 * corre en este repo por ERR_REQUIRE_ASYNC_MODULE — ver
 * scripts/migrate-create-official.mjs y AGENTS.md §Proceso de migraciones),
 * con técnica two-phase: snapshot fase A sin `schedule` → diff fase B con
 * `schedule` = exactamente meta + payload_jobs_stats. El SQL central NO fue
 * escrito a mano; los bloques de seguridad añadidos abajo son los patrones
 * oficiales ya establecidos del repo (20260908_rls_customers_tables.ts).
 *
 * Patrón de 3 pasos (invariante de arquitectura, mismo que RLS #97):
 *  1. IDEMPOTENCIA: si `meta` existe Y `payload_jobs_stats` existe → no-op
 *     (cubre BDs restauradas con el DDL aplicado a mano en su momento).
 *  2. GUARDIA ANTI-POOLER: DDL pendiente + conexión 6543/pooler → throw
 *     accionable (nunca DDL por PgBouncer).
 *  3. CONEXIÓN DIRECTA: DDL idempotente + RLS sobre `payload_jobs_stats`
 *     (tabla nueva del global en schema público — misma decisión de diseño
 *     que las 27 tablas existentes: payload_server_full_access TO postgres,
 *     deny-all para anon/authenticated).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Idempotencia de verificación: `meta` presente + tabla stats presente
  //    → ya aplicada (p.ej. BD restaurada donde el DDL se aplicó por
  //    conexión directa antes del deploy). No-op seguro.
  const check = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payload_jobs'
          AND column_name = 'meta') AS has_meta,
      (SELECT count(*) FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'payload_jobs_stats') AS has_stats_table
  `);
  const row = (
    check as unknown as {
      rows?: Array<{ has_meta?: string | number; has_stats_table?: string | number }>;
    }
  )?.rows?.[0];

  const hasMeta = Number(row?.has_meta) > 0;
  const hasStatsTable = Number(row?.has_stats_table) > 0;

  if (hasMeta && hasStatsTable) {
    // Ya aplicada. No-op seguro (el registro en payload_migrations lo hace
    // el flujo normal de prodMigrations / migrate).
    return;
  }

  // 2. Guardia anti-pooler: el DDL está PENDIENTE y la conexión activa es el
  //    Transaction Pooler (6543) → bloquear antes de cualquier
  //    ALTER/CREATE (invariante AGENTS.md / docs/AGENTS_CONSTITUTION.md).
  const connStr = process.env.DATABASE_URI || process.env.POSTGRES_URL || '';
  const isTransactionPooler = connStr.includes(':6543') || connStr.includes('pooler.supabase.com');

  if (isTransactionPooler) {
    throw new Error(
      '[BLOCKED_TRANSACTION_POOLER_DDL] La migración "20260909_jobs_stats_schema" contiene DDL (ALTER TABLE payload_jobs / CREATE TABLE payload_jobs_stats) pendiente y no puede ejecutarse a través del Transaction Pooler de Supabase (puerto 6543). Para una BD restaurada/nueva: aplicar el DDL por conexión directa (puerto 5432 o Supabase SQL Editor) y registrar la fila en payload_migrations ANTES del deploy. En producción el DDL se aplica por conexión directa (flujo de emergencia de AGENTS.md §Proceso de migraciones) y esta migración corre como no-op en el arranque. Ver docs/AGENTS_CONSTITUTION.md §Migraciones.'
    );
  }

  // 3a. Conexión directa (5432 / CI / local): DDL idempotente generado por
  //     el core (fase B del two-phase). ALTER ... IF NOT EXISTS y CREATE
  //     TABLE IF NOT EXISTS hacen la reaplicación segura.
  await db.execute(sql`
    ALTER TABLE "payload_jobs" ADD COLUMN IF NOT EXISTS "meta" jsonb;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "payload_jobs_stats" (
      "id" serial PRIMARY KEY NOT NULL,
      "stats" jsonb,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );
  `);

  // 3b. RLS sobre la tabla nueva del global (patrón DO-block idempotente de
  //     20260908_rls_customers_tables.ts): postgres = owner de Supabase
  //     (rolbypassrls); para anon/authenticated = deny-all. El role puede
  //     faltar en BDs locales — se crea idempotente si no existe.
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        CREATE ROLE postgres;
      END IF;
    END $$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'public' AND c.relname = 'payload_jobs_stats'
                   AND NOT c.relrowsecurity) THEN
        EXECUTE 'ALTER TABLE public.payload_jobs_stats ENABLE ROW LEVEL SECURITY';
      END IF;
    END $$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies
                     WHERE schemaname = 'public' AND tablename = 'payload_jobs_stats'
                       AND policyname = 'payload_server_full_access') THEN
        EXECUTE 'CREATE POLICY payload_server_full_access ON public.payload_jobs_stats FOR ALL TO postgres USING (true) WITH CHECK (true)';
      END IF;
    END $$;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Guardia simétrica: el rollback de DDL tampoco corre por el pooler.
  const connStr = process.env.DATABASE_URI || process.env.POSTGRES_URL || '';
  const isTransactionPooler = connStr.includes(':6543') || connStr.includes('pooler.supabase.com');

  if (isTransactionPooler) {
    throw new Error(
      '[BLOCKED_TRANSACTION_POOLER_DDL] El rollback del schema de jobs.stats no puede ejecutarse a través del Transaction Pooler de Supabase (puerto 6543).'
    );
  }

  await db.execute(sql`
    DROP POLICY IF EXISTS payload_server_full_access ON public.payload_jobs_stats;
  `);

  await db.execute(sql`
    DROP TABLE IF EXISTS "payload_jobs_stats" CASCADE;
  `);

  await db.execute(sql`
    ALTER TABLE "payload_jobs" DROP COLUMN IF EXISTS "meta";
  `);
}

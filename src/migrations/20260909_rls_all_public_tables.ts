import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * PR 3.3 (plan sprints 2026-09-09, H-1/V8) — RLS durable en TODAS las
 * tablas públicas.
 *
 * HISTORIA: producción tiene 27 tablas con RLS activo + policy
 * payload_server_full_access TO postgres (verificado por Supabase MCP;
 * advisors 0 errores) — pero las migraciones del repo solo cubrían 4
 * (20260908_rls_customers_tables + las que crearon tablas con RLS). Una BD
 * restaurada/nueva recreaba ~23 tablas SIN RLS: riesgo masivo de DR
 * (extensión del hallazgo C3 que PR 7 cerró para 2 tablas).
 *
 * Con el baseline (PR 3.2) esta migración cierra el ciclo completo: una BD
 * nueva arranca la cadena → baseline crea las tablas → ESTA migración aplica
 * RLS a todas en la misma cadena → BD 100% protegida sin pasos manuales.
 *
 * Diseño (misma decisión que las 27 tablas existentes):
 *  - ENABLE ROW LEVEL SECURITY en cada tabla del schema public.
 *  - CREATE POLICY payload_server_full_access FOR ALL TO postgres
 *    (postgres = owner de Supabase, rolbypassrls; documentación de
 *    intención: el servidor accede full; para anon/authenticated = deny-all
 *    — el Data API de Supabase no expone estas colecciones).
 *
 * Patrón de 3 pasos del repo (20260908_rls_customers_tables):
 *  1. IDEMPOTENCIA: 0 tablas sin RLS y sin policy pendiente → no-op
 *     (producción: todo aplicado; el deploy solo registra la fila).
 *  2. GUARDIA ANTI-POOLER: DDL pendiente + 6543/pooler → throw accionable.
 *  3. CONEXIÓN DIRECTA: DO-blocks idempotentes recorriendo catálogos.
 *
 * Tablas NUEVAS futuras: Payload crea tablas sin RLS (el core no las
 * blinda). Esta migración corre UNA VEZ por BD — una tabla añadida DESPUÉS
 * queda fuera hasta que el flujo de emergencia (o una migración puntual
 * como 20260908) la cubra. El advisor de seguridad de Supabase (RLS) es la
 * señal de monitoring para detectarla.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Idempotencia: contar tablas public SIN RLS y SIN la policy.
  const check = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM pg_tables
        WHERE schemaname = 'public' AND NOT rowsecurity) AS without_rls,
      (SELECT count(*) FROM pg_tables t
        WHERE t.schemaname = 'public'
          AND NOT EXISTS (
            SELECT 1 FROM pg_policies p
            WHERE p.schemaname = 'public' AND p.tablename = t.tablename
              AND p.policyname = 'payload_server_full_access'
          )) AS without_policy
  `);
  const row = (
    check as unknown as {
      rows?: Array<{ without_rls?: string | number; without_policy?: string | number }>;
    }
  )?.rows?.[0];

  const withoutRls = Number(row?.without_rls);
  const withoutPolicy = Number(row?.without_policy);

  if (withoutRls === 0 && withoutPolicy === 0) {
    // Ya aplicada (producción: por MCP antes del deploy). No-op seguro.
    return;
  }

  // 2. Guardia anti-pooler: DDL pendiente + Transaction Pooler → bloquear.
  const connStr = process.env.DATABASE_URI || process.env.POSTGRES_URL || '';
  const isTransactionPooler = connStr.includes(':6543') || connStr.includes('pooler.supabase.com');

  if (isTransactionPooler) {
    throw new Error(
      '[BLOCKED_TRANSACTION_POOLER_DDL] La migración "20260909_rls_all_public_tables" contiene DDL (ENABLE ROW LEVEL SECURITY / CREATE POLICY sobre tablas pendientes) y no puede ejecutarse a través del Transaction Pooler de Supabase (puerto 6543). Para una BD restaurada/nueva: aplicar el DDL por conexión directa (puerto 5432 o Supabase SQL Editor) y registrar la fila en payload_migrations ANTES del deploy. En producción el RLS ya está aplicado (vía MCP) y esta migración corre como no-op. Ver docs/AGENTS_CONSTITUTION.md §Migraciones.'
    );
  }

  // 3a. El role `postgres` es el owner de Supabase; en BDs locales puede
  //     faltar — idempotente (mismo patrón 20260908).
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        CREATE ROLE postgres;
      END IF;
    END $$;
  `);

  // 3b. ENABLE ROW LEVEL SECURITY en cada tabla public sin RLS.
  await db.execute(sql`
    DO $$
    DECLARE
      t text;
    BEGIN
      FOR t IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND NOT rowsecurity
      LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      END LOOP;
    END $$;
  `);

  // 3c. CREATE POLICY payload_server_full_access en cada tabla public sin
  //     esa policy (Postgres no soporta CREATE POLICY IF NOT EXISTS).
  await db.execute(sql`
    DO $$
    DECLARE
      t text;
    BEGIN
      FOR t IN
        SELECT tablename FROM pg_tables pt
        WHERE pt.schemaname = 'public'
          AND NOT EXISTS (
            SELECT 1 FROM pg_policies p
            WHERE p.schemaname = 'public' AND p.tablename = pt.tablename
              AND p.policyname = 'payload_server_full_access'
          )
      LOOP
        EXECUTE format(
          'CREATE POLICY payload_server_full_access ON public.%I FOR ALL TO postgres USING (true) WITH CHECK (true)',
          t
        );
      END LOOP;
    END $$;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Guardia simétrica: el rollback de DDL tampoco corre por el pooler.
  const connStr = process.env.DATABASE_URI || process.env.POSTGRES_URL || '';
  const isTransactionPooler = connStr.includes(':6543') || connStr.includes('pooler.supabase.com');

  if (isTransactionPooler) {
    throw new Error(
      '[BLOCKED_TRANSACTION_POOLER_DDL] El rollback del RLS all-tables no puede ejecutarse a través del Transaction Pooler de Supabase (puerto 6543).'
    );
  }

  // NOTA: el down() solo quita lo que ESTA migración añade de forma
  // genérica (las policies payload_server_full_access) y desactiva el RLS
  // en las tablas public. En producción JAMÁS debe correrse (el estado
  // seguro ES el RLS activo); existe por simetría del sistema de
  // migraciones para BDs de test.
  await db.execute(sql`
    DO $$
    DECLARE
      t text;
    BEGIN
      FOR t IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND EXISTS (
            SELECT 1 FROM pg_policies p
            WHERE p.schemaname = 'public' AND p.tablename = pg_tables.tablename
              AND p.policyname = 'payload_server_full_access'
          )
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS payload_server_full_access ON public.%I', t);
      END LOOP;
    END $$;
  `);

  await db.execute(sql`
    DO $$
    DECLARE
      t text;
    BEGIN
      FOR t IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND rowsecurity
      LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
      END LOOP;
    END $$;
  `);
}

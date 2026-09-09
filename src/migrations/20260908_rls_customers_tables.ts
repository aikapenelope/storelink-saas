import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * PR 7 (SPEC-20260907-7, hallazgo C3) — reviews Devin #97 ronda 1 y 2.
 *
 * DDL DURABLE del RLS de las tablas de customers expuestas al Data API de
 * Supabase (customers_purchase_history y
 * customers_preferences_preferred_categories).
 *
 * HISTORIA: el RLS se aplicó primero DIRECTAMENTE en producción vía Supabase
 * MCP (aprobación del dueño en sesión, 2026-09-08) y se documentó en el
 * roadmap. Devin #97 r1 detectó que el DDL vivía SOLO en la BD: una BD
 * restaurada o recién provisionada recreaba las tablas SIN RLS y el
 * hallazgo C3 reaparecía. Esta migración lo registra en el sistema de
 * migraciones del repo.
 *
 * Devin #97 r2 detectó el problema complementario: prodMigrations corre en
 * el ARRANQUE de Payload usando DATABASE_URI — el Transaction Pooler de
 * Supabase (puerto 6543). En una BD restaurada sin el DDL aplicado, up()
 * ejecutaría ALTER TABLE/CREATE POLICY a través del pooler, violando el
 * invariante de arquitectura (AGENTS.md / docs/AGENTS_CONSTITUTION.md:
 * "Migraciones: ejecutar SIEMPRE por conexión directa, NUNCA por pooler")
 * — mismo invariante que 20260902_alter_orders_exchange_rate_numeric.ts
 * blinda. Por eso esta migración sigue el MISMO patrón de 3 pasos:
 *
 * 1. IDEMPOTENCIA: si el RLS y las policies ya están aplicados (producción:
 *    aplicados por MCP antes de este deploy; BDs ya migradas), no-op seguro.
 * 2. GUARDIA ANTI-POOLER: si el DDL está PENDIENTE y la conexión activa es
 *    el pooler (6543 / pooler.supabase.com), se BLOQUEA con error
 *    explícito — un deploy sobre una BD restaurada debe aplicar el DDL por
 *    conexión directa ANTES (Supabase SQL Editor / conexión 5432) y registrar
 *    la fila; el guard evita que PgBouncer reciba DDL bloqueante.
 * 3. CONEXIÓN DIRECTA (5432 / CI / local): ejecuta el DDL idempotente
 *    (DO blocks con detección en catálogos — Postgres no soporta
 *    ALTER TABLE IF EXISTS para ENABLE RLS ni CREATE POLICY IF NOT EXISTS).
 *
 * Nota para restauras: la fila '20260908_rls_customers_tables' se registra
 * en payload_migrations al aplicar el DDL por conexión directa (mismo flujo
 * de emergencia de AGENTS.md §Proceso de migraciones); prodMigrations la
 * saltará en el arranque.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Idempotencia: RLS activo + ambas policies presentes → ya aplicada
  //    (producción la aplicó por MCP; este deploy la registra y no-op).
  const check = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname IN ('customers_purchase_history','customers_preferences_preferred_categories')
          AND NOT c.relrowsecurity) AS without_rls,
      (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('customers_purchase_history','customers_preferences_preferred_categories')
          AND policyname = 'payload_server_full_access') AS policies
  `);
  const row = (
    check as unknown as { rows?: Array<{ without_rls?: string | number; policies?: string | number }> }
  )?.rows?.[0];

  const rlsComplete = Number(row?.without_rls) === 0;
  const policiesComplete = Number(row?.policies) === 2;

  if (rlsComplete && policiesComplete) {
    // Ya aplicada (producción: por MCP antes del deploy). No-op seguro.
    return;
  }

  // 2. Guardia de seguridad para Transaction Pooler (puerto 6543): el DDL
  //    está PENDIENTE y la conexión activa es el pooler → bloquear antes
  //    de intentar cualquier ALTER/CREATE.
  const connStr = process.env.DATABASE_URI || process.env.POSTGRES_URL || '';
  const isTransactionPooler = connStr.includes(':6543') || connStr.includes('pooler.supabase.com');

  if (isTransactionPooler) {
    throw new Error(
      '[BLOCKED_TRANSACTION_POOLER_DDL] La migración "20260908_rls_customers_tables" contiene DDL (ENABLE ROW LEVEL SECURITY / CREATE POLICY) pendiente y no puede ejecutarse a través del Transaction Pooler de Supabase (puerto 6543). Para una BD restaurada/nueva: aplicar el DDL por conexión directa (puerto 5432 o Supabase SQL Editor) y registrar la fila en payload_migrations ANTES del deploy. En producción el DDL ya está aplicado (vía MCP) y esta migración corre como no-op. Ver docs/AGENTS_CONSTITUTION.md §Migraciones.'
    );
  }

  // 3. Conexión directa (puerto 5432 / CI / local): DDL idempotente.
  //    3a. El role `postgres` es el owner de Supabase (existe en
  //    producción); en BDs locales el owner puede ser otro role y
  //    `TO postgres` fallaría — se crea idempotente si falta.
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        CREATE ROLE postgres;
      END IF;
    END $$;
  `);

  // 3b. ENABLE ROW LEVEL SECURITY (detección en catálogo: solo si falta).
  await db.execute(sql`
    DO $$
    DECLARE
      t text;
    BEGIN
      FOREACH t IN ARRAY ARRAY[
        'customers_purchase_history',
        'customers_preferences_preferred_categories'
      ] LOOP
        IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                   WHERE n.nspname = 'public' AND c.relname = t AND NOT c.relrowsecurity) THEN
          EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        END IF;
      END LOOP;
    END $$;
  `);

  // 3c. Policies payload_server_full_access (TO postgres, patrón de las
  //     otras 26 tablas del repo — documentación de intención: postgres
  //     tiene rolbypassrls; para anon/authenticated es deny-all).
  await db.execute(sql`
    DO $$
    DECLARE
      t text;
    BEGIN
      FOREACH t IN ARRAY ARRAY[
        'customers_purchase_history',
        'customers_preferences_preferred_categories'
      ] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_policies
                       WHERE schemaname = 'public' AND tablename = t
                         AND policyname = 'payload_server_full_access') THEN
          EXECUTE format(
            'CREATE POLICY payload_server_full_access ON public.%I FOR ALL TO postgres USING (true) WITH CHECK (true)',
            t
          );
        END IF;
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
      '[BLOCKED_TRANSACTION_POOLER_DDL] El rollback del RLS no puede ejecutarse a través del Transaction Pooler de Supabase (puerto 6543).'
    );
  }

  await db.execute(sql`
    DROP POLICY IF EXISTS payload_server_full_access ON public.customers_purchase_history;
  `);
  await db.execute(sql`
    DROP POLICY IF EXISTS payload_server_full_access ON public.customers_preferences_preferred_categories;
  `);
  await db.execute(sql`
    DO $$
    DECLARE
      t text;
    BEGIN
      FOREACH t IN ARRAY ARRAY[
        'customers_purchase_history',
        'customers_preferences_preferred_categories'
      ] LOOP
        IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                   WHERE n.nspname = 'public' AND c.relname = t AND c.relrowsecurity) THEN
          EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
        END IF;
      END LOOP;
    END $$;
  `);
}

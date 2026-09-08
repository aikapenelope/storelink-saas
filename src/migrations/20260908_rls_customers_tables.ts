import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * PR 7 (SPEC-20260907-7, hallazgo C3) — review Devin #97.
 *
 * DDL DURABLE del RLS de las tablas de customers expuestas al Data API de
 * Supabase (customers_purchase_history y
 * customers_preferences_preferred_categories).
 *
 * HISTORIA: el RLS se aplicó primero DIRECTAMENTE en producción vía Supabase
 * MCP (aprobación del dueño en sesión, 2026-09-08) y se documentó en el
 * roadmap — pero Devin detectó el gap: el DDL vivía SOLO en la BD. Una BD
 * restaurada o recién provisionada recrea las tablas SIN RLS (Payload no
 * modela RLS) y la exposición anónima del Data API (hallazgo C3) reaparece
 * silenciosamente. Esta migración registra el estado en el sistema de
 * migraciones del repo para que TODO arranque nuevo lo reproduzca.
 *
 * IDEMPOTENTE a propósito: el DDL ya está aplicado en producción — al
 * deployar, prodMigrations verá la fila nueva, correrá up() contra tablas
 * que ya tienen RLS y las policies ya creadas, y todo debe ser no-op.
 * Los ALTER TABLE de Postgres no soportan IF EXISTS para ENABLE RLS y
 * CREATE POLICY no soporta IF NOT EXISTS: se usan DO blocks con detección
 * en catálogos (pg_class.relrowsecurity / pg_policies).
 *
 * Las policies siguen el patrón `payload_server_full_access` de las otras 26
 * tablas del repo (TO postgres = documentación de intención: postgres tiene
 * rolbypassrls, verificado en producción; para anon/authenticated es deny-all
 * — ninguna policy les aplica). Supabase recomienda explícitamente este
 * patrón para tablas sin acceso API intencional (doc advisor 0008).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 0. El role `postgres` es el owner de Supabase (existe en producción).
  //    En BDs locales/test el owner puede ser otro role y `TO postgres`
  //    fallaría con "role does not exist" — se crea idempotente si falta
  //    (DO block con CREATE ROLE ... Exceptions; no hay IF NOT EXISTS).
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        CREATE ROLE postgres;
      END IF;
    END $$;
  `);

  // 1. ENABLE ROW LEVEL SECURITY (idempotente por detección en catálogo).
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

  // 2. Policies payload_server_full_access (idempotente: CREATE POLICY no
  //    soporta IF NOT EXISTS — se verifica existencia en pg_policies).
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
  // Reversa simétrica idempotente.
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

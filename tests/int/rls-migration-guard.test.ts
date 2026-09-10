import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import { up, down } from '../../src/migrations/20260908_rls_customers_tables';
import {
  up as jobsStatsUp,
  down as jobsStatsDown,
} from '../../src/migrations/20260909_jobs_stats_schema';
import {
  up as rlsAllUp,
  down as rlsAllDown,
} from '../../src/migrations/20260909_rls_all_public_tables';

/**
 * Review Devin #97 ronda 2: la migración RLS debe seguir el invariante de
 * arquitectura del repo (mismo patrón que 20260902_alter_orders_exchange_rate_
 * numeric.ts):
 *  1. IDEMPOTENTE — producción ya tiene el DDL (aplicado vía MCP): al
 *     deployar, up() debe ser no-op (RLS activo + 2 policies → return).
 *  2. GUARDIA ANTI-POOLER — con el DDL PENDIENTE y conexión por pooler
 *     (6543 / pooler.supabase.com), up() debe BLOQUEAR con
 *     [BLOCKED_TRANSACTION_POOLER_DDL] (prodMigrations corre en el arranque
 *     por DATABASE_URI=pooler: jamás debe enviar DDL por ahí).
 *  3. CONEXIÓN DIRECTA — con el DDL pendiente y conexión directa (test/CI),
 *     aplica ALTER TABLE + CREATE POLICY idempotentes.
 *
 * Este test siembra AMBOS estados contra la BD de test: primero BD
 * "restaurada" (sin RLS — se aplica), luego el estado "producción" (todo
 * aplicado — no-op), y la guardia se valida con DATABASE_URI de pooler.
 */

const runIntegration = !!process.env.TEST_DATABASE_URI;
const d = runIntegration ? describe : describe.skip;

// Conexión DIRECTA por defecto (la que exige el invariante).
const DIRECT_URI = process.env.TEST_DATABASE_URI || '';

let payload: Payload;
type DbLike = { execute: (q: unknown) => Promise<unknown> };
// MigrateUpArgs.db = sesión drizzle de la transacción de migración. En el
// test (sin migrate runner) el equivalente es la instancia drizzle del
// adapter — misma firma de execute(sql).
const dbOf = (p: Payload): DbLike =>
  (p.db as unknown as { drizzle: DbLike }).drizzle;

const rlsState = async (): Promise<Array<{ relname: string; rls: boolean; policies: number }>> => {
  const res = (await dbOf(payload).execute(
    (
      await import('@payloadcms/db-postgres/drizzle')
    ).sql`
      SELECT c.relname as relname, c.relrowsecurity as rls,
             (SELECT count(*) FROM pg_policies p
              WHERE p.schemaname='public' AND p.tablename=c.relname
                AND p.policyname='payload_server_full_access') as policies
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public'
        AND c.relname IN ('customers_purchase_history','customers_preferences_preferred_categories')
      ORDER BY 1
    `
  )) as { rows: Array<{ relname: string; rls: boolean; policies: string | number }> };
  return res.rows.map((r) => ({
    relname: String(r.relname),
    rls: r.rls === true,
    policies: Number(r.policies),
  }));
};

beforeAll(async () => {
  payload = await getPayload({
    config: (await import('../payload.config')).default as never,
  });
  // Aislar el estado: sin RLS ni policies (simula BD restaurada/provisionada).
  await dbOf(payload).execute(
    (await import('@payloadcms/db-postgres/drizzle')).sql`
      ALTER TABLE public.customers_purchase_history DISABLE ROW LEVEL SECURITY;
    `
  );
  await dbOf(payload).execute(
    (await import('@payloadcms/db-postgres/drizzle')).sql`
      ALTER TABLE public.customers_preferences_preferred_categories DISABLE ROW LEVEL SECURITY;
    `
  );
  await dbOf(payload).execute(
    (await import('@payloadcms/db-postgres/drizzle')).sql`
      DROP POLICY IF EXISTS payload_server_full_access ON public.customers_purchase_history;
    `
  );
  await dbOf(payload).execute(
    (await import('@payloadcms/db-postgres/drizzle')).sql`
      DROP POLICY IF EXISTS payload_server_full_access ON public.customers_preferences_preferred_categories;
    `
  );
}, 120000);

afterAll(async () => {
  await payload?.destroy();
});

d('migración RLS 20260908_rls_customers_tables (Devin #97 r2)', () => {
  it('guardia anti-pooler: DDL pendiente + pooler 6543 → BLOCKED (nunca DDL por PgBouncer)', async () => {
    const state = await rlsState();
    expect(state.every((s) => !s.rls)).toBe(true); // DDL pendiente

    const savedUri = process.env.DATABASE_URI;
    (process.env as Record<string, string | undefined>).DATABASE_URI =
      'postgresql://postgres.xyz:pass@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
    try {
      await expect(up({ db: dbOf(payload) } as never)).rejects.toThrow(
        '[BLOCKED_TRANSACTION_POOLER_DDL]'
      );
    } finally {
      if (savedUri === undefined) delete process.env.DATABASE_URI;
      else (process.env as Record<string, string>).DATABASE_URI = savedUri;
    }
    // Nada cambió: la guardia bloqueó ANTES de cualquier DDL.
    const after = await rlsState();
    expect(after.every((s) => !s.rls)).toBe(true);
  }, 60000);

  it('conexión directa: aplica RLS + policies sobre la BD restaurada', async () => {
    const savedUri = process.env.DATABASE_URI;
    (process.env as Record<string, string | undefined>).DATABASE_URI = DIRECT_URI;
    try {
      await up({ db: dbOf(payload) } as never);
    } finally {
      if (savedUri === undefined) delete process.env.DATABASE_URI;
      else (process.env as Record<string, string>).DATABASE_URI = savedUri;
    }

    const state = await rlsState();
    expect(state).toHaveLength(2);
    expect(state.every((s) => s.rls === true)).toBe(true);
    expect(state.every((s) => s.policies === 1)).toBe(true);
  }, 60000);

  it('idempotente: estado producción (todo aplicado) → up() es no-op', async () => {
    // Estado exacto de producción: RLS activo + 2 policies (del test
    // anterior). El deploy real corre aquí y NO debe tocar nada.
    const before = await rlsState();
    expect(before.every((s) => s.rls && s.policies === 1)).toBe(true);

    const savedUri = process.env.DATABASE_URI;
    (process.env as Record<string, string | undefined>).DATABASE_URI = DIRECT_URI;
    try {
      await up({ db: dbOf(payload) } as never); // no-op, no throw
    } finally {
      if (savedUri === undefined) delete process.env.DATABASE_URI;
      else (process.env as Record<string, string>).DATABASE_URI = savedUri;
    }

    const after = await rlsState();
    expect(after).toEqual(before); // intacto
  }, 60000);

  it('down() simétrico: guarda anti-pooler + reversa idempotente', async () => {
    const savedUri = process.env.DATABASE_URI;
    (process.env as Record<string, string | undefined>).DATABASE_URI =
      'postgresql://postgres.xyz:pass@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
    try {
      await expect(down({ db: dbOf(payload) } as never)).rejects.toThrow(
        '[BLOCKED_TRANSACTION_POOLER_DDL]'
      );
    } finally {
      if (savedUri === undefined) delete (process.env as Record<string, string | undefined>).DATABASE_URI;
      else (process.env as Record<string, string>).DATABASE_URI = savedUri;
    }

    await down({ db: dbOf(payload) } as never);
    const state = await rlsState();
    expect(state.every((s) => !s.rls)).toBe(true);
    expect(state.every((s) => s.policies === 0)).toBe(true);
  }, 60000);
});

// El vi.mock del import dinámico de config no es necesario: los tests int usan
// tests/payload.config.ts (push:true — el esquema ya existe).
void vi;

// ---------------------------------------------------------------------------
// PR 1.1 (plan sprints 2026-09-09): migración jobs.stats (meta +
// payload_jobs_stats) — mismo invariante de 3 pasos contra la BD de test
// (tests/payload.config.ts monta reconcileJobs → el esquema de test YA tiene
// meta + payload_jobs_stats: exactamente el estado "producción tras aplicar").
// ---------------------------------------------------------------------------
const jobsStatsState = async (): Promise<{
  hasMeta: boolean;
  hasStatsTable: boolean;
  statsRls: boolean;
  statsPolicies: number;
}> => {
  const res = (await dbOf(payload).execute(
    (
      await import('@payloadcms/db-postgres/drizzle')
    ).sql`
      SELECT
        (SELECT count(*) FROM information_schema.columns
          WHERE table_schema='public' AND table_name='payload_jobs'
            AND column_name='meta') AS has_meta,
        (SELECT count(*) FROM information_schema.tables
          WHERE table_schema='public' AND table_name='payload_jobs_stats') AS has_stats_table,
        (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relname='payload_jobs_stats' AND c.relrowsecurity) AS stats_rls,
        (SELECT count(*) FROM pg_policies
          WHERE schemaname='public' AND tablename='payload_jobs_stats'
            AND policyname='payload_server_full_access') AS stats_policies
    `
  )) as { rows: Array<{ has_meta?: string; has_stats_table?: string; stats_rls?: string; stats_policies?: string }> };
  const r = res.rows[0];
  return {
    hasMeta: Number(r?.has_meta) > 0,
    hasStatsTable: Number(r?.has_stats_table) > 0,
    statsRls: Number(r?.stats_rls) > 0,
    statsPolicies: Number(r?.stats_policies ?? 0),
  };
};

d('migración jobs.stats 20260909_jobs_stats_schema (PR 1.1, P0 N1)', () => {
  it('guardia anti-pooler: DDL pendiente + pooler 6543 → BLOCKED (nunca DDL por PgBouncer)', async () => {
    // Estado pendiente: quitar meta + tabla stats (simula BD de producción
    // actual, donde el drift vive).
    await dbOf(payload).execute(
      (await import('@payloadcms/db-postgres/drizzle')).sql`
        DROP POLICY IF EXISTS payload_server_full_access ON public.payload_jobs_stats;
      `
    );
    await dbOf(payload).execute(
      (await import('@payloadcms/db-postgres/drizzle')).sql`
        DROP TABLE IF EXISTS public.payload_jobs_stats CASCADE;
      `
    );
    await dbOf(payload).execute(
      (await import('@payloadcms/db-postgres/drizzle')).sql`
        ALTER TABLE public.payload_jobs DROP COLUMN IF EXISTS meta;
      `
    );

    const state = await jobsStatsState();
    expect(state.hasMeta).toBe(false); // DDL pendiente
    expect(state.hasStatsTable).toBe(false);

    const savedUri = process.env.DATABASE_URI;
    (process.env as Record<string, string | undefined>).DATABASE_URI =
      'postgresql://postgres.xyz:pass@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
    try {
      await expect(jobsStatsUp({ db: dbOf(payload) } as never)).rejects.toThrow(
        '[BLOCKED_TRANSACTION_POOLER_DDL]'
      );
    } finally {
      if (savedUri === undefined) delete process.env.DATABASE_URI;
      else (process.env as Record<string, string | undefined>).DATABASE_URI = savedUri;
    }
    // Nada cambió: la guardia bloqueó ANTES de cualquier DDL.
    const after = await jobsStatsState();
    expect(after.hasMeta).toBe(false);
    expect(after.hasStatsTable).toBe(false);
  }, 60000);

  it('conexión directa: aplica meta + payload_jobs_stats + RLS sobre la tabla nueva', async () => {
    const savedUri = process.env.DATABASE_URI;
    (process.env as Record<string, string | undefined>).DATABASE_URI = DIRECT_URI;
    try {
      await jobsStatsUp({ db: dbOf(payload) } as never);
    } finally {
      if (savedUri === undefined) delete process.env.DATABASE_URI;
      else (process.env as Record<string, string | undefined>).DATABASE_URI = savedUri;
    }

    const state = await jobsStatsState();
    expect(state.hasMeta).toBe(true);
    expect(state.hasStatsTable).toBe(true);
    expect(state.statsRls).toBe(true);
    expect(state.statsPolicies).toBe(1);
  }, 60000);

  it('idempotente: estado producción (todo aplicado) → up() es no-op', async () => {
    // Estado exacto de producción tras el flujo de emergencia: meta + tabla
    // + RLS ya aplicados. El deploy real corre aquí y NO debe tocar nada.
    const before = await jobsStatsState();
    expect(before.hasMeta && before.hasStatsTable && before.statsRls).toBe(true);

    const savedUri = process.env.DATABASE_URI;
    (process.env as Record<string, string | undefined>).DATABASE_URI = DIRECT_URI;
    try {
      await jobsStatsUp({ db: dbOf(payload) } as never); // no-op, no throw
    } finally {
      if (savedUri === undefined) delete process.env.DATABASE_URI;
      else (process.env as Record<string, string | undefined>).DATABASE_URI = savedUri;
    }

    const after = await jobsStatsState();
    expect(after).toEqual(before); // intacto
  }, 60000);

  it('down() simétrico: guardia anti-pooler + reversa completa', async () => {
    const savedUri = process.env.DATABASE_URI;
    (process.env as Record<string, string | undefined>).DATABASE_URI =
      'postgresql://postgres.xyz:pass@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
    try {
      await expect(jobsStatsDown({ db: dbOf(payload) } as never)).rejects.toThrow(
        '[BLOCKED_TRANSACTION_POOLER_DDL]'
      );
    } finally {
      if (savedUri === undefined) delete (process.env as Record<string, string | undefined>).DATABASE_URI;
      else (process.env as Record<string, string | undefined>).DATABASE_URI = savedUri;
    }

    await jobsStatsDown({ db: dbOf(payload) } as never);
    const state = await jobsStatsState();
    expect(state.hasMeta).toBe(false);
    expect(state.hasStatsTable).toBe(false);
    expect(state.statsPolicies).toBe(0);

    // Restaurar el esquema de test (push:true lo creó con jobs.stats): sin
    // esto, los tests que corren DESPUÉS en la suite (reconcile-dispatch,
    // order-workflow) heredan un payload_jobs sin meta y fallan. Re-aplicar
    // up() es idempotente-seguro (mismo flujo que el test anterior).
    (process.env as Record<string, string | undefined>).DATABASE_URI = DIRECT_URI;
    await jobsStatsUp({ db: dbOf(payload) } as never);
    const restored = await jobsStatsState();
    expect(restored.hasMeta && restored.hasStatsTable && restored.statsRls).toBe(true);
  }, 60000);
});

// ---------------------------------------------------------------------------
// PR 3.3 (plan sprints 2026-09-09, H-1/V8): RLS durable en TODAS las tablas
// públicas. Contra la BD de test (28 tablas, la mayoría SIN RLS — push:true
// no blinda): verifica la aplicación masiva + idempotencia + guardia. Al
// final RESTAURA nada: dejar la BD de test con RLS en todas las tablas es el
// estado seguro (idéntico a producción) y no afecta a la suite (todo corre
// con overrideAccess + rol owner angelpenalver, que es superuser).
// ---------------------------------------------------------------------------
const allTablesRlsState = async (): Promise<{ withoutRls: number; withoutPolicy: number }> => {
  const res = (await dbOf(payload).execute(
    (
      await import('@payloadcms/db-postgres/drizzle')
    ).sql`
      SELECT
        (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity) AS without_rls,
        (SELECT count(*) FROM pg_tables t WHERE t.schemaname='public'
          AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
            AND p.tablename=t.tablename AND p.policyname='payload_server_full_access')) AS without_policy
    `
  )) as { rows: Array<{ without_rls?: string; without_policy?: string }> };
  const r = res.rows[0];
  return { withoutRls: Number(r?.without_rls ?? 0), withoutPolicy: Number(r?.without_policy ?? 0) };
};

d('migración RLS all-tables 20260909_rls_all_public_tables (PR 3.3, H-1)', () => {
  it('aplica RLS + policy a TODAS las tablas public de la BD (estado pendiente)', async () => {
    const before = await allTablesRlsState();
    // La BD de test (push:true) tiene tablas sin RLS — estado pendiente real.
    expect(before.withoutRls).toBeGreaterThan(0);

    const savedUri = process.env.DATABASE_URI;
    (process.env as Record<string, string | undefined>).DATABASE_URI = DIRECT_URI;
    try {
      await rlsAllUp({ db: dbOf(payload) } as never);
    } finally {
      if (savedUri === undefined) delete process.env.DATABASE_URI;
      else (process.env as Record<string, string | undefined>).DATABASE_URI = savedUri;
    }

    const after = await allTablesRlsState();
    expect(after.withoutRls).toBe(0);
    expect(after.withoutPolicy).toBe(0);
  }, 60000);

  it('guardia anti-pooler: DDL pendiente + pooler 6543 → BLOCKED', async () => {
    // Simular pendiente: desactivar RLS de una tabla cualquiera.
    await dbOf(payload).execute(
      (await import('@payloadcms/db-postgres/drizzle')).sql`
        ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
      `
    );
    const pending = await allTablesRlsState();
    expect(pending.withoutRls).toBe(1);

    const savedUri = process.env.DATABASE_URI;
    (process.env as Record<string, string | undefined>).DATABASE_URI =
      'postgresql://postgres.xyz:pass@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
    try {
      await expect(rlsAllUp({ db: dbOf(payload) } as never)).rejects.toThrow(
        '[BLOCKED_TRANSACTION_POOLER_DDL]'
      );
    } finally {
      if (savedUri === undefined) delete process.env.DATABASE_URI;
      else (process.env as Record<string, string | undefined>).DATABASE_URI = savedUri;
    }

    // Nada cambió.
    const after = await allTablesRlsState();
    expect(after.withoutRls).toBe(1);

    // Restaurar el estado seguro (RLS en todas — el test anterior lo dejó así).
    (process.env as Record<string, string | undefined>).DATABASE_URI = DIRECT_URI;
    await rlsAllUp({ db: dbOf(payload) } as never);
    const restored = await allTablesRlsState();
    expect(restored.withoutRls).toBe(0);
  }, 60000);

  it('idempotente: estado producción (todo aplicado) → up() es no-op', async () => {
    const before = await allTablesRlsState();
    expect(before.withoutRls).toBe(0);
    expect(before.withoutPolicy).toBe(0);

    const savedUri = process.env.DATABASE_URI;
    (process.env as Record<string, string | undefined>).DATABASE_URI = DIRECT_URI;
    try {
      await rlsAllUp({ db: dbOf(payload) } as never); // no-op, no throw
    } finally {
      if (savedUri === undefined) delete process.env.DATABASE_URI;
      else (process.env as Record<string, string | undefined>).DATABASE_URI = savedUri;
    }

    const after = await allTablesRlsState();
    expect(after).toEqual(before); // intacto
  }, 60000);

  it('down() seguro: guardia anti-pooler + no-op (NO desactiva RLS)', async () => {
    const savedUri = process.env.DATABASE_URI;
    (process.env as Record<string, string | undefined>).DATABASE_URI =
      'postgresql://postgres.xyz:pass@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
    try {
      await expect(rlsAllDown({ db: dbOf(payload) } as never)).rejects.toThrow(
        '[BLOCKED_TRANSACTION_POOLER_DDL]'
      );
    } finally {
      if (savedUri === undefined) delete (process.env as Record<string, string | undefined>).DATABASE_URI;
      else (process.env as Record<string, string | undefined>).DATABASE_URI = savedUri;
    }

    // Review Devin #113 (flag SEC «Rollback disables database access controls
    // globally»): el down() es un NO-OP deliberado — deshacer el RLS
    // all-tables globalmente expondría tablas protegidas por migraciones
    // anteriores. Por conexión directa NO debe tocar nada.
    const before = await allTablesRlsState();
    expect(before.withoutRls).toBe(0);
    expect(before.withoutPolicy).toBe(0);

    (process.env as Record<string, string | undefined>).DATABASE_URI = DIRECT_URI;
    try {
      await rlsAllDown({ db: dbOf(payload) } as never);
    } finally {
      if (savedUri === undefined) delete (process.env as Record<string, string | undefined>).DATABASE_URI;
      else (process.env as Record<string, string | undefined>).DATABASE_URI = savedUri;
    }

    const after = await allTablesRlsState();
    expect(after).toEqual(before); // intacto
    expect(after.withoutRls).toBe(0);
    expect(after.withoutPolicy).toBe(0);
  }, 60000);
});

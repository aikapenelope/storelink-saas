import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import { up, down } from '../../src/migrations/20260908_rls_customers_tables';

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

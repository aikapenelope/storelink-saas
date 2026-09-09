import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import config from '../payload.config';
import {
  up as fkIdxUp,
  down as fkIdxDown,
} from '../../src/migrations/20260909_fk_junction_indexes';

/**
 * PR 3.5 (plan sprints 2026-09-09, V7): índices FK de junction tables.
 * Los 3 índices EXACTOS del schema runtime (nombres verificados contra el
 * snapshot del baseline y la BD de test con push:true). Producción no los
 * tiene (advisors: 4 FKs sin índice); la BD de test SÍ — el test dropea los
 * 3 para sembrar el estado prod y verifica la aplicación + idempotencia +
 * guardia anti-pooler. pushDevSchema los recrea en el próximo arranque de
 * la suite, así que el drop del setup es seguro.
 */

const runIntegration = !!process.env.TEST_DATABASE_URI;
const d = runIntegration ? describe : describe.skip;
const DIRECT_URI = process.env.TEST_DATABASE_URI || '';

let payload: Payload;
type DbLike = { execute: (q: unknown) => Promise<unknown> };
const dbOf = (p: Payload): DbLike =>
  (p.db as unknown as { drizzle: { execute: DbLike['execute'] } }).drizzle;

const fkIndexesState = async (): Promise<number> => {
  const res = (await dbOf(payload).execute(
    (
      await import('@payloadcms/db-postgres/drizzle')
    ).sql`
      SELECT count(*) AS present FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'customers_purchase_history_parent_id_idx',
          'customers_purchase_history_order_id_idx',
          'customers_preferences_preferred_categories_parent_id_idx'
        )
    `
  )) as { rows: Array<{ present?: string }> };
  return Number(res.rows[0]?.present ?? 0);
};

beforeAll(async () => {
  payload = await getPayload({ config: config as never });
}, 120000);

afterAll(async () => {
  await payload?.destroy();
});

d('migración índices FK 20260909_fk_junction_indexes (PR 3.5, V7)', () => {
  it('aplica los 3 índices del schema runtime sobre el estado prod (dropped)', async () => {
    // Sembrar estado producción DESPUÉS del init (pushDevSchema del beforeAll
    // recrea los índices del schema runtime en cada arranque).
    await dbOf(payload).execute(
      (await import('@payloadcms/db-postgres/drizzle')).sql`
        DROP INDEX IF EXISTS "customers_purchase_history_parent_id_idx";
      `
    );
    await dbOf(payload).execute(
      (await import('@payloadcms/db-postgres/drizzle')).sql`
        DROP INDEX IF EXISTS "customers_purchase_history_order_id_idx";
      `
    );
    await dbOf(payload).execute(
      (await import('@payloadcms/db-postgres/drizzle')).sql`
        DROP INDEX IF EXISTS "customers_preferences_preferred_categories_parent_id_idx";
      `
    );

    const before = await fkIndexesState();
    expect(before).toBe(0); // estado sembrado: como producción

    const savedUri = process.env.DATABASE_URI;
    (process.env as Record<string, string | undefined>).DATABASE_URI = DIRECT_URI;
    try {
      await fkIdxUp({ db: dbOf(payload) } as never);
    } finally {
      if (savedUri === undefined) delete process.env.DATABASE_URI;
      else (process.env as Record<string, string | undefined>).DATABASE_URI = savedUri;
    }

    expect(await fkIndexesState()).toBe(3);
  }, 60000);

  it('idempotente: estado aplicado → up() es no-op (producción tras aplicar)', async () => {
    const before = await fkIndexesState();
    expect(before).toBe(3);

    const savedUri = process.env.DATABASE_URI;
    (process.env as Record<string, string | undefined>).DATABASE_URI = DIRECT_URI;
    try {
      await fkIdxUp({ db: dbOf(payload) } as never);
    } finally {
      if (savedUri === undefined) delete process.env.DATABASE_URI;
      else (process.env as Record<string, string | undefined>).DATABASE_URI = savedUri;
    }

    expect(await fkIndexesState()).toBe(3);
  }, 60000);

  it('down() simétrico: guardia anti-pooler + reversa limpia', async () => {
    const savedUri = process.env.DATABASE_URI;
    (process.env as Record<string, string | undefined>).DATABASE_URI =
      'postgresql://postgres.xyz:pass@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
    try {
      await expect(fkIdxDown({ db: dbOf(payload) } as never)).rejects.toThrow(
        '[BLOCKED_TRANSACTION_POOLER_DDL]'
      );
    } finally {
      if (savedUri === undefined) delete (process.env as Record<string, string | undefined>).DATABASE_URI;
      else (process.env as Record<string, string | undefined>).DATABASE_URI = savedUri;
    }

    await fkIdxDown({ db: dbOf(payload) } as never);
    expect(await fkIndexesState()).toBe(0);

    // Restaurar (la suite completa puede depender de los índices del schema
    // de test — push:true los recrearía, pero idempotencia ante todo).
    (process.env as Record<string, string | undefined>).DATABASE_URI = DIRECT_URI;
    await fkIdxUp({ db: dbOf(payload) } as never);
    expect(await fkIndexesState()).toBe(3);
  }, 60000);
});

void vi;

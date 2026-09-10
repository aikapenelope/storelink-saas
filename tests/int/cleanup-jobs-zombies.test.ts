import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import config from '../payload.config';

/**
 * PR 2.1 (plan sprints 2026-09-09, N2): recuperación de jobs ZOMBIES (r2).
 *
 * Un job cuya lambda muere a mitad queda processing=true sin completedAt ni
 * hasError → el runner no lo reclama (query del core exige processing:false),
 * el sweep no re-encola la orden y las purgas por retención no lo tocan →
 * orden sin despacho + fila inmortal.
 *
 * Fix r2 (review Devin #107): recuperación SEGURA y ACOTADA:
 *  1. zombie SEGURO de >1h (order-created) → reseteado a false + contador
 *  2. job EN VUELO reciente (5 min) → NO tocado (margen 12x sobre Vercel 300s)
 *  3. zombie NO SEGURO (catalogImportRows) → marcado terminal, NO reseteado
 *  4. zombie SEGURO agotado (zombieResets=3) → marcado terminal, NO reseteado
 *  5. 401 sin x-cron-secret (gate intacto)
 */

vi.stubEnv('CRON_SECRET', 'test-cron-secret');

const runIntegration = !!process.env.TEST_DATABASE_URI;
const d = runIntegration ? describe : describe.skip;

let payload: Payload;
const seededIds: number[] = [];

beforeAll(async () => {
  payload = await getPayload({ config: config as never });
}, 120000);

afterAll(async () => {
  for (const id of seededIds) {
    await (
      payload.db as unknown as {
        deleteMany: (args: { collection: string; where: Record<string, unknown> }) => Promise<unknown>;
      }
    ).deleteMany({
      collection: 'payload-jobs',
      where: { id: { equals: id } },
    }).catch(() => null);
  }
  await payload.destroy();
});

/** Siembra un job processing=true con edad, slugs y meta dados. */
async function seedJob(opts: {
  ageMinutes: number;
  workflowSlug?: string | null;
  taskSlug?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<number> {
  const ts = new Date(Date.now() - opts.ageMinutes * 60 * 1000).toISOString();
  // `??` caería al default con null explícito; hay que distinguir "no provisto"
  // (default 'order-created') de "null explícito" (job sin workflow — p.ej. un
  // task suelto como catalogImportRows).
  const workflowSlug = opts.workflowSlug === undefined ? 'order-created' : opts.workflowSlug;
  const taskSlug = opts.taskSlug === undefined ? null : opts.taskSlug;
  const metaJson = opts.meta == null ? null : JSON.stringify(opts.meta);
  const res = (await payload.db.drizzle.execute(
    (
      await import('@payloadcms/db-postgres/drizzle')
    ).sql`
      insert into payload_jobs
        (input, total_tried, has_error, workflow_slug, task_slug, queue, wait_until, processing, meta, created_at, updated_at, completed_at)
      values (
        ${JSON.stringify({ orderId: 888888001 })}::jsonb,
        1,
        false,
        ${workflowSlug},
        ${taskSlug},
        'default',
        null,
        true,
        ${metaJson}::jsonb,
        ${ts},
        ${ts},
        null
      )
      returning id
    `
  )) as { rows?: Array<{ id: number }> };
  const id = Number(res.rows?.[0]?.id);
  seededIds.push(id);
  return id;
}

async function jobState(id: number): Promise<{
  processing: boolean | null;
  hasError: boolean | null;
  zombieResets: number | null;
}> {
  const res = (await payload.db.drizzle.execute(
    (
      await import('@payloadcms/db-postgres/drizzle')
    ).sql`
      select processing, has_error, (meta->>'zombieResets')::int as zombie_resets
      from payload_jobs where id = ${id}
    `
  )) as { rows?: Array<{ processing: boolean; has_error: boolean; zombie_resets: number | null }> };
  const row = res.rows?.[0];
  return {
    processing: row ? row.processing : null,
    hasError: row ? row.has_error : null,
    zombieResets: row ? row.zombie_resets : null,
  };
}

async function callCleanup(): Promise<{
  status: number;
  body: { ok: boolean; zombiesReset: number; zombiesTerminated: number };
}> {
  const { POST } = await import('../../src/app/api/admin/cleanup-jobs/route');
  const response = await POST(
    new Request('http://localhost/api/admin/cleanup-jobs', {
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    }) as unknown as Parameters<typeof POST>[0]
  );
  return { status: response.status, body: (await response.json()) as never };
}

d('cleanup-jobs: reset de zombies processing:true huérfanos (PR 2.1, N2 r2)', () => {
  it('un zombie SEGURO de >1h se resetea a processing=false y cuenta el reset', async () => {
    const id = await seedJob({ ageMinutes: 120 }); // 2h — muy pasado el staleness

    const { status, body } = await callCleanup();
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.zombiesReset).toBeGreaterThanOrEqual(1);

    const st = await jobState(id);
    expect(st.processing).toBe(false);
    expect(st.zombieResets).toBe(1);
  }, 60000);

  it('un job EN VUELO reciente (5 min) NO se toca (staleness protege los legítimos)', async () => {
    const id = await seedJob({ ageMinutes: 5 });

    await callCleanup();

    const st = await jobState(id);
    expect(st.processing).toBe(true);
    expect(st.hasError).toBe(false);
    expect(st.zombieResets).toBeNull();
  }, 60000);

  it('un zombie NO SEGURO (catalogImportRows) se marca terminal, NO se resetea', async () => {
    const id = await seedJob({ ageMinutes: 120, workflowSlug: null, taskSlug: 'catalogImportRows' });

    const { body } = await callCleanup();
    expect(body.zombiesTerminated).toBeGreaterThanOrEqual(1);

    const st = await jobState(id);
    expect(st.processing).toBe(true); // NO reseteado (replay duplicaría productos)
    expect(st.hasError).toBe(true); // marcado terminal para intervención manual
  }, 60000);

  it('un zombie SEGURO agotado (zombieResets=3) se marca terminal, NO se resetea', async () => {
    const id = await seedJob({ ageMinutes: 120, meta: { zombieResets: 3 } });

    const { body } = await callCleanup();
    expect(body.zombiesTerminated).toBeGreaterThanOrEqual(1);

    const st = await jobState(id);
    expect(st.processing).toBe(true);
    expect(st.hasError).toBe(true);
  }, 60000);

  it('401 sin x-cron-secret (gate intacto)', async () => {
    const { POST } = await import('../../src/app/api/admin/cleanup-jobs/route');
    const response = await POST(
      new Request('http://localhost/api/admin/cleanup-jobs', {
        method: 'POST',
      }) as unknown as Parameters<typeof POST>[0]
    );
    expect(response.status).toBe(401);
  }, 60000);
});

void vi;

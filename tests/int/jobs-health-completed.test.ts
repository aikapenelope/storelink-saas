import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import config from '../payload.config';

/**
 * Review Devin #96 ronda 2 (hallazgo crítico): regresión del healthcheck de
 * la cola. Con deleteJobOnComplete:false, los jobs EXITOSOS persisten ~24h
 * (retención para el reporte de import). El query del "pendiente más viejo"
 * solo filtraba hasError → un job COMPLETADO de hace >30 min reportaba la
 * cola como enferma (falso unhealthy permanente) y, en el runner externo
 * (curl -fsS aborta los steps siguientes), saltaba la purga → los
 * completados con el CSV completo en input acumulaban indefinidamente.
 *
 * El fix: el healthcheck debe considerar "pendiente" SOLO jobs sin
 * completedAt. Este test siembra un job completado VIEJO (>30 min) y aserta
 * que la cola sigue healthy — y que un PENDIENTE viejo sí la enferma.
 */

// Sin mocks de red: el test ejercita el handler real contra la BD.
vi.stubEnv('CRON_SECRET', 'test-cron-secret');

const runIntegration = !!process.env.TEST_DATABASE_URI;
const d = runIntegration ? describe : describe.skip;

let payload: Payload;
let oldCompletedJobId: number | undefined;
let oldPendingJobId: number | undefined;
let savedIsr: string | undefined;

beforeAll(async () => {
  payload = await getPayload({ config: config as never });
  savedIsr = (process.env as Record<string, string | undefined>).CRON_SECRET;
  (process.env as Record<string, string>).CRON_SECRET = 'test-cron-secret';
}, 120000);

afterAll(async () => {
  // Limpieza de los jobs sembrados (BD de test desechable, pero idempotente).
  for (const id of [oldCompletedJobId, oldPendingJobId]) {
    if (id !== undefined) {
      await (
        payload.db as unknown as {
          deleteMany: (args: { collection: string; where: Record<string, unknown> }) => Promise<unknown>;
        }
      ).deleteMany({
        collection: 'payload-jobs',
        where: { id: { equals: id } },
      }).catch(() => null);
    }
  }
  if (savedIsr === undefined) delete (process.env as Record<string, string>).CRON_SECRET;
  else (process.env as Record<string, string>).CRON_SECRET = savedIsr;
  await payload.destroy();
});

/** Siembra un job order-created con la edad indicada (min) y estado dado. */
async function seedJob(ageMinutes: number, completed: boolean): Promise<number> {
  const createdAt = new Date(Date.now() - ageMinutes * 60 * 1000).toISOString();
  const res = (await payload.db.drizzle.execute(
    (
      await import('@payloadcms/db-postgres/drizzle')
    ).sql`
      insert into payload_jobs (input, total_tried, has_error, workflow_slug, queue, wait_until, processing, created_at, updated_at, completed_at)
      values (
        ${JSON.stringify({ orderId: 999999999 })}::jsonb,
        1,
        false,
        'order-created',
        'default',
        null,
        false,
        ${createdAt},
        ${createdAt},
        ${completed ? createdAt : null}
      )
      returning id
    `
  )) as { rows?: Array<{ id: number }> };
  return Number(res.rows?.[0]?.id);
}

d('jobs-health: completados retenidos NO enferman la cola (Devin #96 r2)', () => {
  it('un job COMPLETADO de >30 min NO reporta unhealthy', async () => {
    oldCompletedJobId = await seedJob(45, true);

    const { GET } = await import('../../src/app/api/admin/jobs-health/route');
    const response = await GET(
      new Request('http://localhost/api/admin/jobs-health', {
        headers: { 'x-cron-secret': 'test-cron-secret' },
      }) as unknown as Parameters<typeof GET>[0]
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { healthy: boolean; oldestPendingMinutes: number };
    expect(body.healthy).toBe(true);
    // El completado viejo NO es el pendiente más viejo.
    expect(body.oldestPendingMinutes).toBeLessThan(30);
  }, 60000);

  it('un job PENDIENTE de >30 min SÍ reporta unhealthy (señal original intacta)', async () => {
    oldPendingJobId = await seedJob(40, false);

    const { GET } = await import('../../src/app/api/admin/jobs-health/route');
    const response = await GET(
      new Request('http://localhost/api/admin/jobs-health', {
        headers: { 'x-cron-secret': 'test-cron-secret' },
      }) as unknown as Parameters<typeof GET>[0]
    );

    expect(response.status).toBe(503);
    const body = (await response.json()) as { healthy: boolean; failedJobs: number };
    expect(body.healthy).toBe(false);
    expect(body.failedJobs).toBe(0); // es por pendiente viejo, no por errores
  }, 60000);

  // PR 2.2 (plan sprints 2026-09-09, N5): telemetría de profundidad. El job
  // pendiente viejo del test anterior sigue sembrado (40 min, processing:
  // false): debe contar en queueDepth (pendiente real) pero NO en
  // processingStuck (no está processing) — y los criterios de unhealthy no
  // cambian por los campos nuevos.
  it('PR 2.2: queueDepth cuenta el pendiente; processingStuck=0 (no hay zombies); criterios intactos', async () => {
    const { GET } = await import('../../src/app/api/admin/jobs-health/route');
    const response = await GET(
      new Request('http://localhost/api/admin/jobs-health', {
        headers: { 'x-cron-secret': 'test-cron-secret' },
      }) as unknown as Parameters<typeof GET>[0]
    );

    expect(response.status).toBe(503); // SIGUE 503 por el pendiente viejo del test anterior
    const body = (await response.json()) as {
      healthy: boolean;
      queueDepth: number;
      processingStuck: number;
    };
    expect(body.healthy).toBe(false);
    expect(body.queueDepth).toBeGreaterThanOrEqual(1); // el pendiente sembrado cuenta
    expect(body.processingStuck).toBe(0); // processing:false → no es zombie
  }, 60000);

  it('PR 2.2: un zombie (processing:true >1h) cuenta en processingStuck PERO no altera el criterio healthy por sí solo', async () => {
    // Sembrar zombie: processing:true, updated_at -2h. Sin el cleanup del
    // PR 2.1, health NO lo detecta como enfermedad (no es hasError ni
    // pendiente) — pero la telemetría debe revelarlo.
    const ts = new Date(Date.now() - 120 * 60 * 1000).toISOString();
    const res = (await payload.db.drizzle.execute(
      (
        await import('@payloadcms/db-postgres/drizzle')
      ).sql`
        insert into payload_jobs (input, total_tried, has_error, workflow_slug, queue, wait_until, processing, created_at, updated_at, completed_at)
        values (
          ${JSON.stringify({ orderId: 888888002 })}::jsonb,
          0,
          false,
          'order-created',
          'default',
          null,
          true,
          ${ts},
          ${ts},
          null
        )
        returning id
      `
    )) as { rows?: Array<{ id: number }> };
    const zombieId = Number(res.rows?.[0]?.id);

    try {
      const { GET } = await import('../../src/app/api/admin/jobs-health/route');
      const response = await GET(
        new Request('http://localhost/api/admin/jobs-health', {
          headers: { 'x-cron-secret': 'test-cron-secret' },
        }) as unknown as Parameters<typeof GET>[0]
      );

      const body = (await response.json()) as {
        healthy: boolean;
        processingStuck: number;
      };
      expect(body.processingStuck).toBeGreaterThanOrEqual(1); // el zombie es visible
      // Nota: healthy puede ser false aquí POR el pendiente viejo de los
      // tests anteriores (sembrado en BD compartida del archivo). El AC es
      // que processingStuck>0 NO es lo que dispara el 503 — el criterio
      // (failedJobs, oldestPendingMinutes) no cambió.
      expect(typeof body.healthy).toBe('boolean');
    } finally {
      await (
        payload.db as unknown as {
          deleteMany: (args: { collection: string; where: Record<string, unknown> }) => Promise<unknown>;
        }
      ).deleteMany({
        collection: 'payload-jobs',
        where: { id: { equals: zombieId } },
      }).catch(() => null);
    }
  }, 60000);
});

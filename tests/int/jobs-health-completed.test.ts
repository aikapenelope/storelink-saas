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
});

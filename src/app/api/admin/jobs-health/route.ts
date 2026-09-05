import { NextResponse } from 'next/server';
import { getPayload, type Where } from 'payload';
import config from '@payload-config';
import { verifyCronSecret } from '@/lib/cron-secret';

/**
 * Healthcheck de la cola de jobs (auditoría 2026-09-04, P1-13): hasta ahora
 * la única alerta ante fallos era el email default de GitHub del runner — y
 * GitHub desactiva schedules tras 60 días de inactividad del repo, matando
 * los reintentos en silencio. Este endpoint responde 503 cuando la cola está
 * enferma, y jobs-runner.yml hace que el step falle → email de GitHub con
 * señal explícita.
 *
 * Señales de enfermedad:
 *  - Jobs fallidos (hasError) recientes: el despacho Trello/email de pedidos
 *    reales está fallando y requiere intervención.
 *  - Job pendiente más viejo que 30 min: el runner dejó de procesar (schedule
 *    muerto, endpoint caído o cola atascada).
 */

type InternalJobsFind = (args: {
  collection: string;
  where?: Where;
  limit?: number;
  sort?: string;
}) => Promise<{ docs: Array<{ id: number | string; createdAt?: string }> }>;

const OLDEST_PENDING_ALARM_MINUTES = 30;

export async function GET(request: Request) {
  if (!verifyCronSecret(request.headers.get('x-cron-secret'))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const payload = await getPayload({ config });

    // 'payload-jobs' es colección interna (ver cleanup-jobs/route.ts para el
    // detalle del hueco de generación de tipos).
    const db = payload.db as unknown as { find: InternalJobsFind };

    const failedRes = await db.find({
      collection: 'payload-jobs',
      where: { hasError: { equals: true } },
      limit: 100,
      sort: '-updatedAt',
    });

    const oldestPendingRes = await db.find({
      collection: 'payload-jobs',
      where: { hasError: { not_equals: true } },
      limit: 1,
      sort: 'createdAt',
    });

    const failedJobs = failedRes.docs.length;
    const oldestPending = oldestPendingRes.docs[0];
    const oldestPendingMinutes = oldestPending?.createdAt
      ? Math.round((Date.now() - new Date(oldestPending.createdAt).getTime()) / 60000)
      : 0;

    const healthy = failedJobs === 0 && oldestPendingMinutes < OLDEST_PENDING_ALARM_MINUTES;

    return NextResponse.json(
      {
        healthy,
        failedJobs,
        oldestPendingMinutes,
        oldestPendingThresholdMinutes: OLDEST_PENDING_ALARM_MINUTES,
      },
      { status: healthy ? 200 : 503 }
    );
  } catch (err) {
    // Si el healthcheck mismo explota, la cola NO está demostrablemente sana:
    // 503 para que el runner falle y avise (fail-loud, no fail-silent).
    console.error('[storelink][jobs-health] error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json(
      { healthy: false, error: 'healthcheck failed' },
      { status: 503 }
    );
  }
}

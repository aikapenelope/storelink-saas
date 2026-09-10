import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
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
 *
 * PR 2.2 (plan sprints 2026-09-09, N5): TELEMETRÍA de profundidad —
 * queueDepth (pendientes totales) y processingStuck (processing:true sin
 * completar >1h — los zombies del PR 2.1 antes de que el cleanup los
 * resetee). Telemetría pura: los criterios de 503 NO cambian (evita falsos
 * positivos nuevos hasta estabilizar); el dashboard del runner GHA las
 * reporta en cada golpe.
 */

const OLDEST_PENDING_ALARM_MINUTES = 30;

export async function GET(request: Request) {
  if (!verifyCronSecret(request.headers.get('x-cron-secret'))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const payload = await getPayload({ config });

    // PR 2.2 (review Devin #108 r2): payload.count hace COUNT(*) sin
    // materializar docs. OJO: limit:0 en payload.find NO es "solo conteo",
    // es "sin límite" — trae y materializa TODOS los docs (pesados: el input
    // guarda el CSV completo). count() devuelve { totalDocs } directamente.
    const failedRes = await payload.count({
      collection: 'payload-jobs' as never,
      where: { hasError: { equals: true } },
      overrideAccess: true,
    });

    const oldestPendingRes = await payload.find({
      collection: 'payload-jobs' as never,
      where: {
        and: [
          { hasError: { not_equals: true } },
          // Review Devin #96 ronda 2 (hallazgo crítico): con
          // deleteJobOnComplete:false los jobs EXITOSOS persisten ~24h
          // (retención de /api/admin/cleanup-jobs para el reporte de
          // import). Sin excluirlos, el "pendiente más viejo" era siempre
          // un job completado de hace >24h y el healthcheck reportaba
          // unhealthy a los 30 min — falso positivo permanente que además
          // saltaba el cleanup en el runner (curl -fsS aborta los steps
          // siguientes) y los completados acumulaban indefinidamente.
          // Pendiente REAL = sin completedAt.
          { completedAt: { exists: false } },
        ],
      },
      limit: 1,
      sort: 'createdAt',
      overrideAccess: true,
    });

    const failedJobs = failedRes.totalDocs;
    const oldestPending = (oldestPendingRes.docs as unknown as Array<{ id: string | number; createdAt?: string }>)[0];
    const oldestPendingMinutes = oldestPending?.createdAt
      ? Math.round((Date.now() - new Date(oldestPending.createdAt).getTime()) / 60000)
      : 0;

    // PR 2.2 (N5): profundidad de cola — misma condición de "pendiente real"
    // del query de arriba (sin completedAt). Un zombie aparece aquí como
    // pendiente indistinguible hasta que el cleanup del PR 2.1 lo resetee.
    // payload.count (COUNT(*), sin materializar docs).
    const queueDepthRes = await payload.count({
      collection: 'payload-jobs' as never,
      where: {
        and: [
          { hasError: { not_equals: true } },
          { completedAt: { exists: false } },
        ],
      },
      overrideAccess: true,
    });
    const queueDepth = queueDepthRes.totalDocs;

    // processingStuck: processing:true sin completar ni error y updated_at
    // >1h — el estado zombie PREVIO al reset del PR 2.1 (si el cleanup
    // corre sano, debe ser casi siempre 0; >0 sostenido = el cleanup no
    // está llegando o los jobs mueren más rápido de lo que se purgan).
    const stuckCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const stuckRes = await payload.count({
      collection: 'payload-jobs' as never,
      where: {
        and: [
          { processing: { equals: true } },
          { completedAt: { exists: false } },
          { hasError: { not_equals: true } },
          { updatedAt: { less_than: stuckCutoff } },
        ],
      },
      overrideAccess: true,
    });
    const processingStuck = stuckRes.totalDocs;

    // Criterios de 503 SIN cambio (PR 2.2): queueDepth/processingStuck son
    // telemetría — no disparan unhealthy por sí solos.
    const healthy = failedJobs === 0 && oldestPendingMinutes < OLDEST_PENDING_ALARM_MINUTES;

    return NextResponse.json(
      {
        healthy,
        failedJobs,
        oldestPendingMinutes,
        oldestPendingThresholdMinutes: OLDEST_PENDING_ALARM_MINUTES,
        queueDepth,
        processingStuck,
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

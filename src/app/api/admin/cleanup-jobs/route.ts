import { NextResponse } from 'next/server';
import { getPayload, type Where } from 'payload';
import config from '@payload-config';
import { verifyCronSecret } from '@/lib/cron-secret';

/**
 * Purga de jobs fallidos (plan v2 R2 / hallazgo NV3).
 *
 * El `deleteJobOnComplete` oficial SOLO borra los exitosos
 * (packages/payload/src/queues/operations/runJobs/index.ts): los fallidos
 * (hasError=true) persisten indefinidamente y quedan fuera de procesamiento
 * (la query del runner los excluye con hasError not_equals true). Con 3
 * intentos por tarea, cada fallo persistente de Trello/Resend deja filas
 * huérfanas que este endpoint purga tras la retención indicada.
 *
 * Mecanismo idéntico al interno de Payload: payload.db.deleteMany sobre la
 * colección de jobs — sin hooks ni versiones innecesarias. Autenticación:
 * x-cron-secret timing-safe, el mismo secreto del runner externo.
 */

const CLEANUP_RETENTION_DAYS = 30;

/**
 * 'payload-jobs' es la colección INTERNA de la Jobs Queue: existe en runtime
 * y en BD (migración 20260822_jobs_queue.ts, tabla "payload_jobs"; ruta
 * oficial /api/payload-jobs/run), pero NO aparece en el union CollectionSlug
 * generado porque payload-types solo refleja colecciones de usuario. El cast
 * tipado está justificado por ese hueco de generación — mismo patrón ya usado
 * en src/lib/delivery-note.ts (SignedUrlClient del AWS SDK).
 */
type InternalJobsDeleteMany = (args: {
  collection: string;
  where: Where;
}) => Promise<{ deletedCount?: number }>;

export async function POST(request: Request) {
  if (!verifyCronSecret(request.headers.get('x-cron-secret'))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const payload = await getPayload({ config });
    const cutoff = new Date(
      Date.now() - CLEANUP_RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const res = await (payload.db as unknown as { deleteMany: InternalJobsDeleteMany }).deleteMany({
      collection: 'payload-jobs',
      where: {
        and: [
          { hasError: { equals: true } },
          { createdAt: { less_than: cutoff } },
        ],
      },
    });

    const deleted = (res as { deletedCount?: number } | undefined)?.deletedCount;
    console.log('[storelink][cleanup-jobs] fallidos >30d purgados:', deleted ?? 'n/a');
    return NextResponse.json({ ok: true, deleted: deleted ?? null });
  } catch (err) {
    console.error('[storelink][cleanup-jobs] error:', err);
    return NextResponse.json({ error: 'Error interno en la limpieza' }, { status: 500 });
  }
}

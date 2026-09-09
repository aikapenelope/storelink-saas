import { NextResponse } from 'next/server';
import { getPayload, type Where } from 'payload';
import config from '@payload-config';
import { verifyCronSecret } from '@/lib/cron-secret';

/**
 * Purga de jobs antiguos (plan v2 R2 / hallazgo NV3 + review Devin #72).
 *
 * Dos retenciones:
 *  - FALLIDOS (hasError=true) >30d: persisten indefinidamente (deleteJobOnComplete
 *    no los toca) y quedan fuera de procesamiento (la query del runner los excluye
 *    con hasError not_equals true). Se purgan a los 30 días.
 *  - COMPLETADOS (completedAt seteado) >24h: desde que deleteJobOnComplete pasó a
 *    false (mismo PR), los exitosos persisten para que /api/[tenant]/import-status
 *    pueda leer su output (created/updated/rejectedImageUrls). 24h es de sobra
 *    para el polling del cliente admin; después se purgan para que la tabla no
 *    crezca (el input incluye el CSV completo).
 *
 * Mecanismo idéntico al interno de Payload: payload.db.deleteMany sobre la
 * colección de jobs — sin hooks ni versiones innecesarias. Autenticación:
 * x-cron-secret timing-safe, el mismo secreto del runner externo.
 */

const FAILED_RETENTION_DAYS = 30;
const COMPLETED_RETENTION_HOURS = 24;

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
    const failedCutoff = new Date(
      Date.now() - FAILED_RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const completedCutoff = new Date(
      Date.now() - COMPLETED_RETENTION_HOURS * 60 * 60 * 1000
    ).toISOString();

    const deleteMany = (payload.db as unknown as {
      deleteMany: InternalJobsDeleteMany;
    }).deleteMany;

    // 1. Fallidos (hasError) >30d
    const failedRes = await deleteMany({
      collection: 'payload-jobs',
      where: {
        and: [
          { hasError: { equals: true } },
          { createdAt: { less_than: failedCutoff } },
        ] as Where[],
      },
    });

    // 2. Completados (completedAt seteado) >24h — review Devin #72
    const completedRes = await deleteMany({
      collection: 'payload-jobs',
      where: {
        and: [
          { completedAt: { exists: true } },
          { completedAt: { less_than: completedCutoff } },
        ] as Where[],
      },
    });

    const deletedFailed = (failedRes as { deletedCount?: number } | undefined)?.deletedCount;
    const deletedCompleted = (completedRes as { deletedCount?: number } | undefined)?.deletedCount;
    console.log(
      '[storelink][cleanup-jobs] purgados — fallidos >30d:',
      deletedFailed ?? 'n/a',
      '| completados >24h:',
      deletedCompleted ?? 'n/a'
    );
    return NextResponse.json({ ok: true, deleted: deletedFailed ?? null, deletedCompleted: deletedCompleted ?? null });
  } catch (err) {
    console.error('[storelink][cleanup-jobs] error:', err);
    return NextResponse.json({ error: 'Error interno en la limpieza' }, { status: 500 });
  }
}

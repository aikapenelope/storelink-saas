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
const ZOMBIE_STALENESS_HOURS = 1;
const MAX_ZOMBIE_RECOVERIES = 3;

/**
 * PR 2.1 (plan sprints 2026-09-09, N2): recuperación de jobs ZOMBIES (r2).
 *
 * Un job cuya lambda muere a mitad queda processing=true sin completedAt ni
 * hasError → el runner no lo reclama (query del core exige processing:false),
 * el sweep no re-encola la orden y las purgas por retención no lo tocan →
 * orden sin despacho definitivo + fila inmortal.
 *
 * Recuperación r2 (review Devin #107, 3 hallazgos):
 *  - ALLOWLIST: solo se auto-recuperan jobs PROBADAMENTE idempotentes — el
 *    workflow `order-created` y sus tasks (idempotentes por sentinels
 *    trelloCardUrl/emailConfirmationSent) y el sweep `reconcileDispatchOrders`
 *    (sin efectos externos). `catalogImportRows` se EXCLUYE: genera
 *    `SKU-${Date.now()}` para filas sin SKU → replay duplicaría productos.
 *    Los zombies NO seguros se marcan terminal (has_error=true), no se resetean.
 *  - ACOTADO: `meta.zombieResets` (jsonb) cuenta las recuperaciones; al llegar a
 *    MAX_ZOMBIE_RECOVERIES el job se marca terminal en vez de resetear (un job
 *    que hard-crashea SIEMPRE no consume la cola indefinidamente).
 *  - MARGEN: updated_at > 1h (12x el timeout de Vercel 300s) — nunca se toca un
 *    job legítimamente en vuelo.
 *
 * TODO(3.89): deprecable con el lease nativo processingUntil/processingToken
 * (payloadcms/payload#17220, mergeado en main pero NO publicado — latest 3.88.0)
 * que recupera zombies sin paso de limpieza. Al upgradear: eliminar este bloque
 * y el test asociado.
 */

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

/**
 * Executor SQL del adapter (db.drizzle.execute — session drizzle del
 * postgresAdapter). Mismo patrón que los tests de integración contra las
 * tablas internas de la Jobs Queue. El UPDATE de `processing`/`has_error`/
 * `meta` de payload_jobs no tiene equivalente en la Local API (la colección
 * es interna y su CRUD está cerrado a super-admin por jobsCollectionOverrides),
 * así que el raw es la vía correcta para este caso de infraestructura — no
 * salta hooks de datos de negocio.
 */
type InternalDbExecute = (query: unknown) => Promise<{ rows?: unknown[] }>;

export async function POST(request: Request) {
  if (!verifyCronSecret(request.headers.get('x-cron-secret'))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const payload = await getPayload({ config });
    const drizzle = (payload.db as unknown as { drizzle: { execute: InternalDbExecute } }).drizzle;
    const { sql } = await import('@payloadcms/db-postgres/drizzle');

    // 0. PR 2.1 (r2): recuperación de zombies ANTES de las purgas (un zombie
    //    también acumula: primero se recupera/marca, luego se purga por
    //    retención). Dos pasadas sobre la MISMA ventana de staleness:
    //    (a) reset de los SEGUROS con presupuesto restante; (b) terminal de
    //    los NO seguros o AGOTADOS. La allowlist va como literales en el SQL
    //    (constantes del repo, sin input externo — cero riesgo de inyección);
    //    mantener en sync con los slugs registrados en payload.config.ts.
    //    COALESCE(slug::text, '') normaliza los NULL: un task suelto no tiene
    //    workflow_slug (y viceversa) y `NULL IN (...)` devuelve NULL → la
    //    lógica de 3 valores excluiría el job de AMBAS pasadas (zombie eterno).
    //    `::text` cubre el enum de la BD de test (push:true) vs el varchar de
    //    producción (columna enum en test, varchar en prod).
    const resetRes = (await drizzle.execute(sql`
      UPDATE payload_jobs
      SET processing = false,
          updated_at = now(),
          meta = jsonb_set(
            COALESCE(meta, '{}'::jsonb),
            '{zombieResets}',
            to_jsonb(COALESCE((meta->>'zombieResets')::int, 0) + 1)
          )
      WHERE processing = true
        AND completed_at IS NULL
        AND has_error = false
        AND updated_at < now() - make_interval(hours => ${ZOMBIE_STALENESS_HOURS})
        AND (
          COALESCE(workflow_slug::text, '') IN ('order-created')
          OR COALESCE(task_slug::text, '') IN ('trelloDispatchOrder', 'sendOrderConfirmationEmail', 'reconcileDispatchOrders')
        )
        AND COALESCE((meta->>'zombieResets')::int, 0) < ${MAX_ZOMBIE_RECOVERIES}
      RETURNING id
    `)) as { rows?: Array<{ id: number }> };

    const terminatedRes = (await drizzle.execute(sql`
      UPDATE payload_jobs
      SET has_error = true,
          updated_at = now()
      WHERE processing = true
        AND completed_at IS NULL
        AND has_error = false
        AND updated_at < now() - make_interval(hours => ${ZOMBIE_STALENESS_HOURS})
        AND (
          NOT (
            COALESCE(workflow_slug::text, '') IN ('order-created')
            OR COALESCE(task_slug::text, '') IN ('trelloDispatchOrder', 'sendOrderConfirmationEmail', 'reconcileDispatchOrders')
          )
          OR COALESCE((meta->>'zombieResets')::int, 0) >= ${MAX_ZOMBIE_RECOVERIES}
        )
      RETURNING id
    `)) as { rows?: Array<{ id: number }> };

    const zombiesReset = resetRes?.rows?.length ?? 0;
    const zombiesTerminated = terminatedRes?.rows?.length ?? 0;
    if (zombiesReset > 0 || zombiesTerminated > 0) {
      console.log(
        `[storelink][cleanup-jobs] zombies — reseteados: ${zombiesReset} [${resetRes?.rows?.map((r) => r.id).join(',') ?? ''}] | terminales: ${zombiesTerminated} [${terminatedRes?.rows?.map((r) => r.id).join(',') ?? ''}]`
      );
    }

    const failedCutoff = new Date(
      Date.now() - FAILED_RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const completedCutoff = new Date(
      Date.now() - COMPLETED_RETENTION_HOURS * 60 * 60 * 1000
    ).toISOString();

    // 1. Fallidos (hasError) >30d — SIN destructuring del método del adapter:
    //    deleteMany depende de `this` (this.payload.collections en
    //    @payloadcms/drizzle deleteMany.js:8). Destructurarlo (const deleteMany
    //    = adapter.deleteMany) pierde el binding y lanza "reading 'payload'" —
    //    bug incidental preexistente descubierto por el test nuevo de zombies.
    const failedRes = await (payload.db as unknown as {
      deleteMany: InternalJobsDeleteMany;
    }).deleteMany({
      collection: 'payload-jobs',
      where: {
        and: [
          { hasError: { equals: true } },
          { createdAt: { less_than: failedCutoff } },
        ] as Where[],
      },
    });

    // 2. Completados (completedAt seteado) >24h — review Devin #72
    const completedRes = await (payload.db as unknown as {
      deleteMany: InternalJobsDeleteMany;
    }).deleteMany({
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
      deletedCompleted ?? 'n/a',
      '| zombies reseteados:',
      zombiesReset,
      '| zombies terminales:',
      zombiesTerminated
    );
    return NextResponse.json({
      ok: true,
      deleted: deletedFailed ?? null,
      deletedCompleted: deletedCompleted ?? null,
      zombiesReset,
      zombiesTerminated,
    });
  } catch (err) {
    console.error('[storelink][cleanup-jobs] error:', err);
    return NextResponse.json({ error: 'Error interno en la limpieza' }, { status: 500 });
  }
}

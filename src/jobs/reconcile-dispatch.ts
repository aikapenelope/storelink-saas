import type { TaskConfig } from 'payload';
import type { Order } from '@/payload-types';

/**
 * PR 6a (SPEC-20260907-6, auditoría B1): sweep de reconciliación del
 * despacho de pedidos. Hasta ahora, si el `jobs.queue` del checkout fallaba
 * (checkout.ts:1108) o la función serverless moría antes del `after()`, el
 * pedido quedaba SIN tarjeta de Trello y SIN email para siempre: no existía
 * ningún mecanismo de reparación.
 *
 * Patrón oficial (docs/jobs-queue/scheduled-tasks): task con `schedule`
 * (cron cada 30 min). En Vercel serverless el autoRun interno no corre
 * (documentado en el propio tipo: "should not be used on serverless
 * platforms like Vercel") — pero el endpoint oficial
 * /api/payload-jobs/run, que el runner externo (.github/workflows/
 * jobs-runner.yml, cada 5 min) YA golpea, llama primero a
 * payload.jobs.handleSchedules() (verificado en
 * payload/dist/queues/endpoints/run.js:31): encola el job del schedule
 * cuando toca por cron y luego ejecuta la cola. Cero infraestructura
 * nueva, cero crons extra de Vercel (plan Hobby: 1 cron/día ya usado).
 *
 * El task es IDEMPOTENTE por diseño:
 *  - Solo re-encola órdenes con despacho incompleto
 *    (trelloCardUrl vacío/'__pending__' o emailConfirmationSent:false)
 *    creadas hace menos de 48h (ventana de reparación acotada: más allá,
 *    la orden es irrelevante operativamente y no se re-procesa).
 *  - El workflow order-created ya es idempotente por sentinel
 *    (trelloCardUrl !== '__pending__' → skip) y flag
 *    (emailConfirmationSent → skip), así que re-encolar es seguro.
 *  - Un mismo orderId puede tener varios jobs en cola sin daño; el sweep
 *    corre cada 30 min y la ventana de 48h con límite de 50 órdenes por
 *    pasada acota el volumen.
 */

/** Ventana de reconciliación: órdenes creadas hace menos de 48h. */
const RECONCILE_WINDOW_HOURS = 48;
/** Máximo de órdenes re-encoladas por pasada (acota el trabajo del task). */
const RECONCILE_BATCH_LIMIT = 50;

type ReconcileOutput = {
  candidates: number;
  requeued: number;
};

const reconcileDispatchOrders: TaskConfig = {
  slug: 'reconcileDispatchOrders',
  label: 'Sweep de reconciliación de despachos (re-encola pedidos sin Trello/email)',
  // Sin input: toda la lógica deriva del estado de la BD.
  inputSchema: [],
  outputSchema: [
    { name: 'candidates', type: 'number' },
    { name: 'requeued', type: 'number' },
  ],
  schedule: [{ cron: '*/30 * * * *', queue: 'default' }],
  handler: async ({ req }): Promise<{ output: ReconcileOutput }> => {
    const { payload } = req;

    const windowStart = new Date(
      Date.now() - RECONCILE_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();

    // ------------------------------------------------------------------
    // Exclusiones PRIMERO (review Devin #96 hallazgo 2): el batch limit de
    // 50 debe aplicar a órdenes ELEGIBLES, no a la query cruda. Si el límite
    // cortara la query inicial, un bloque de 50 órdenes recientes con job
    // vivo (o cota agotada) monopolizaría cada pasada y las huérfanas más
    // viejas jamás serían examinadas hasta salir de la ventana de 48h.
    // ------------------------------------------------------------------

    // "Sin job vivo" (SPEC-20260907-6): una orden que ya tiene un job
    // order-created en cola (no completado, sin error) será despachada por
    // el runner — re-encolarla apila duplicados. La colección interna
    // 'payload-jobs' existe en runtime y BD (migración 20260822_jobs_queue)
    // aunque no en el union CollectionSlug — mismo cast documentado que
    // cleanup-jobs/jobs-health.
    const pendingJobsRes = (await payload.find({
      collection: 'payload-jobs' as never,
      where: {
        and: [
          { workflowSlug: { equals: 'order-created' } },
          { completedAt: { exists: false } },
          { hasError: { not_equals: true } },
        ],
      },
      limit: 500,
      overrideAccess: true,
      depth: 0,
    } as never)) as unknown as {
      docs: Array<{ input?: { orderId?: number | string } }>;
    };

    const dispatchedOrderIds = new Set(
      (pendingJobsRes.docs ?? [])
        .map((j) => Number(j.input?.orderId))
        .filter((n) => Number.isFinite(n))
    );

    // Cota anti-loop (tenant sin Trello ni email configurados): una orden
    // cuyo despacho YA corrió completos N veces sin dejar los flags en true
    // (ambos canales skipped por configuración ausente) sería re-encolada
    // cada pasada durante 48h. Con deleteJobOnComplete:false (PR 6b) los
    // jobs completados persisten ~24h: contarlos da la cota natural. Máximo
    // MAX_RECONCILE_ATTEMPTS jobs completados por orden en la ventana de
    // retención; más allá, la orden se considera irreparable por sweep y
    // queda para intervención manual (visible en jobs con hasError o en el
    // admin de órdenes).
    const MAX_RECONCILE_ATTEMPTS = 3;

    const completedJobsRes = (await payload.find({
      collection: 'payload-jobs' as never,
      where: {
        and: [
          { workflowSlug: { equals: 'order-created' } },
          { completedAt: { exists: true } },
        ],
      },
      limit: 500,
      overrideAccess: true,
      depth: 0,
    } as never)) as unknown as {
      docs: Array<{ input?: { orderId?: number | string } }>;
    };

    const completedAttemptsByOrder = new Map<number, number>();
    for (const j of completedJobsRes.docs ?? []) {
      const id = Number(j.input?.orderId);
      if (Number.isFinite(id)) {
        completedAttemptsByOrder.set(id, (completedAttemptsByOrder.get(id) ?? 0) + 1);
      }
    }

    // ------------------------------------------------------------------
    // Candidatas con paginación: se recorren páginas de la query de huérfanas
    // (la más reciente primero) aplicando las exclusiones hasta acumular
    // RECONCILE_BATCH_LIMIT órdenes ELEGIBLES o agotar las páginas — así un
    // bloque de órdenes no-elegibles jamás oculta a las más viejas.
    // ------------------------------------------------------------------
    let candidates = 0;
    let requeued = 0;
    const PAGE_SIZE = 200;
    let page = 1;
    let eligibleCollected = 0;

    while (eligibleCollected < RECONCILE_BATCH_LIMIT) {
      // Órdenes con despacho incompleto dentro de la ventana. La condición
      // `or` cubre los tres estados de huérfanas: sentinel '__pending__' (job
      // murió a mitad de la tarjeta), trelloCardUrl null/vacío (nunca se creó
      // la tarjeta), y email pendiente (checkbox NOT NULL default false en
      // BD — verificado: not_equals:true es seguro). Canceladas excluidas.
      const orphansRes = await payload.find({
        collection: 'orders',
        where: {
          and: [
            { createdAt: { greater_than: windowStart } },
            { status: { not_equals: 'cancelled' } },
            {
              or: [
                { trelloCardUrl: { like: '__pending__' } },
                { trelloCardUrl: { exists: false } },
                { emailConfirmationSent: { not_equals: true } },
              ],
            },
          ],
        },
        limit: PAGE_SIZE,
        page,
        sort: '-createdAt',
        overrideAccess: true,
        depth: 0,
      });

      if (orphansRes.docs.length === 0) break;
      candidates += orphansRes.docs.length;

      for (const order of orphansRes.docs as Order[]) {
        if (eligibleCollected >= RECONCILE_BATCH_LIMIT) break;
        const orderIdNum = Number(order.id);
        if (dispatchedOrderIds.has(orderIdNum)) {
          continue; // ya hay un job vivo para esta orden
        }
        if ((completedAttemptsByOrder.get(orderIdNum) ?? 0) >= MAX_RECONCILE_ATTEMPTS) {
          continue; // agotada la cota de reconciliación: requiere revisión manual
        }
        eligibleCollected++;
        try {
          await payload.jobs.queue({
            workflow: 'order-created',
            input: { orderId: order.id as number },
            req,
          });
          requeued++;
        } catch (err) {
          console.error(
            `[storelink][reconcile-dispatch] no se pudo re-encolar la orden ${order.id} (orderNumber ${order.orderNumber}):`,
            err instanceof Error ? err.message : 'unknown error'
          );
        }
      }

      // Fin de páginas alcanzado.
      if (orphansRes.docs.length < PAGE_SIZE) break;
      page++;
      // Cota de seguridad de paginación (ventana 48h — no puede haber
      // millones, pero el while jamás debe vivir más allá de lo razonable).
      if (page > 50) break;
    }

    if (requeued > 0) {
      console.log(
        `[storelink][reconcile-dispatch] ${requeued}/${candidates} órdenes re-encoladas para despacho (ventana ${RECONCILE_WINDOW_HOURS}h, límite de elegibles ${RECONCILE_BATCH_LIMIT})`
      );
    }

    return { output: { candidates, requeued } };
  },
};

export const reconcileJobs = {
  tasks: [reconcileDispatchOrders],
};

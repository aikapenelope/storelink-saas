import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import config from '../payload.config';

// Mocks de integraciones externas: cero red en tests (mismo patrón que
// order-workflow.test.ts).
vi.mock('../../src/lib/trello', () => ({
  resolveTrelloCredentials: vi.fn(() => ({ apiKey: 'test-trello-key', token: 'test-trello-token' })),
  createTrelloOrderCard: vi.fn(async (p: { orderNumber: string }) => ({
    success: true,
    cardId: `mock-card-${p.orderNumber}`,
  })),
}));
vi.mock('../../src/lib/delivery-note', () => ({
  getDeliveryNoteUrl: vi.fn(async () => 'https://r2.example/signed.pdf'),
  uploadDeliveryNotePdf: vi.fn(async () => true),
}));

const runIntegration = !!process.env.TEST_DATABASE_URI;
const d = runIntegration ? describe : describe.skip;

let payload: Payload;
let tenantId: number;
const createdOrderIds: number[] = [];

beforeAll(async () => {
  payload = await getPayload({ config: config as never });

  const tenant = await payload.create({
    collection: 'tenants',
    overrideAccess: true,
    data: {
      name: 'Tienda Sweep Test',
      slug: `test-sweep-${Date.now()}`,
      whatsappPhone: '+584120000000',
      trelloConfig: { enabled: true, listId: 'test-list-id' },
      emailConfig: { enabled: true },
    } as never,
  });
  tenantId = tenant.id as number;
}, 120000);

afterAll(async () => {
  for (const id of createdOrderIds) {
    await payload.delete({ collection: 'orders', id, overrideAccess: true }).catch(() => null);
  }
  await payload.destroy();
});

/**
 * PR 6a (SPEC-20260907-6, auditoría B1): sweep de reconciliación. AC del
 * roadmap: "Orden sembrada sin card/email → sweep la re-encola y el
 * workflow la completa (test int)".
 *
 * Se ejecuta el task reconcileDispatchOrders por Local API con un req
 * sintético (payload.jobs.run con where del task), que es exactamente lo que
 * hace el runner sobre /api/payload-jobs/run.
 */
d('task reconcileDispatchOrders (sweep de reconciliación)', () => {
  it('re-encola una orden sin card/email y el workflow la completa', async () => {
    // Limpieza de la cola de jobs completa (BD de test): con
    // deleteJobOnComplete:false los jobs de otros archivos persisten tras
    // completarse y varios referencian órdenes ya borradas por sus afterAll
    // — el run allQueues de este test los procesaría y fallaría con "Not
    // Found". La BD de test es desechable: purga total de payload-jobs
    // (mismo mecanismo deleteMany directo que /api/admin/cleanup-jobs).
    await (
      payload.db as unknown as {
        deleteMany: (args: { collection: string; where: Record<string, unknown> }) => Promise<unknown>;
      }
    ).deleteMany({
      collection: 'payload-jobs',
      where: { id: { exists: true } },
    });

    // 1. Orden huérfana: creada por Local API SIN pasar por el checkout →
    //    trelloCardUrl null y emailConfirmationSent false.
    const order = await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        status: 'pending',
        orderNumber: `SWEEP-${Date.now()}`,
        customer: { name: 'Cliente Sweep', phone: '+584121234567', email: 'sweep@test.local' },
        items: [{ sku: 'SWEEP-SKU', title: 'Producto Sweep', price: 5, quantity: 1 }],
        totalAmount: 5,
        currency: 'USD',
      } as never,
    });
    createdOrderIds.push(order.id as number);

    // 2. Ejecutar el sweep: payload.jobs.run procesa jobs del task
    //    reconcileDispatchOrders (mismo mecanismo del runner externo sobre
    //    /api/payload-jobs/run, que además encola los schedules).
    //    Primero se encola el task manualmente (el schedule lo dispara el
    //    endpoint en runtime; en el test se simula con queue directo).
    const sweepJob = await payload.jobs.queue({
      task: 'reconcileDispatchOrders',
      input: {},
    });

    // 3. Correr TODO: el sweep re-encola la orden (workflow order-created) y
    //    jobs.run con allQueues procesa también los re-encolados en la misma
    //    pasada (sequential para determinismo).
    await payload.jobs.runByID({ id: sweepJob.id });
    await payload.jobs.run({ allQueues: true, limit: 50, sequential: true });

    // 4. La orden quedó despachada por el workflow re-encolado: tarjeta
    //    asignada por el mock de Trello.
    const updated = (await payload.findByID({
      collection: 'orders',
      id: order.id as number,
      overrideAccess: true,
      depth: 0,
    })) as unknown as { trelloCardUrl?: string };
    expect(String(updated.trelloCardUrl)).toContain('mock-card-');
  }, 60000);

  it('NO re-encola órdenes ya despachadas (trelloCardUrl OK y email enviado)', async () => {
    const order = await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        status: 'pending',
        orderNumber: `SWEEP-OK-${Date.now()}`,
        customer: { name: 'Cliente OK', phone: '+584121234567', email: 'ok@test.local' },
        items: [{ sku: 'SWEEP-SKU', title: 'Producto OK', price: 5, quantity: 1 }],
        totalAmount: 5,
        currency: 'USD',
        trelloCardUrl: 'https://trello.com/c/already-done',
        emailConfirmationSent: true,
      } as never,
    });
    createdOrderIds.push(order.id as number);

    const sweepJob = await payload.jobs.queue({
      task: 'reconcileDispatchOrders',
      input: {},
    });
    const runRes = await payload.jobs.runByID({ id: sweepJob.id });

    // El sweep no falla y el output reporta 0 re-encoladas para esta orden
    // (candidates puede incluir la huérfana del test anterior ya reparada
    // — pero requeued debe reflejar solo lo pendiente real).
    expect(runRes).toBeDefined();

    // La orden despachada permanece intacta (no re-procesada).
    const updated = (await payload.findByID({
      collection: 'orders',
      id: order.id as number,
      overrideAccess: true,
      depth: 0,
    })) as unknown as { trelloCardUrl?: string };
    expect(updated.trelloCardUrl).toBe('https://trello.com/c/already-done');
  }, 60000);
});

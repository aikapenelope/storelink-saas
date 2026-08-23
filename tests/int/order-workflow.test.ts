import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import config from '../payload.config';

// Mocks de integraciones externas: cero red en tests.
vi.mock('../../src/lib/trello', () => ({
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
let productId: number;
const createdOrderIds: number[] = [];

beforeAll(async () => {
  payload = await getPayload({ config: config as never });

  // Semilla: tenant + producto
  const tenant = await payload.create({
    collection: 'tenants',
    overrideAccess: true,
    data: {
      name: 'Tienda Test',
      slug: `test-${Date.now()}`,
      whatsappPhone: '+584120000000',
      trelloConfig: { enabled: true, listId: 'test-list-id' },
      emailConfig: { enabled: true },
    } as never,
  });
  tenantId = tenant.id as number;

  const product = await payload.create({
    collection: 'products',
    overrideAccess: true,
    data: {
      tenant: tenantId,
      title: 'Producto Test',
      price: 10,
      sku: `TEST-SKU-${Date.now()}`,
      trackStock: true,
      stockQuantity: 5,
      stockStatus: 'in_stock',
    } as never,
  });
  productId = product.id as number;
}, 120000);

afterAll(async () => {
  for (const id of createdOrderIds) {
    await payload.delete({ collection: 'orders', id, overrideAccess: true }).catch(() => null);
  }
  await payload.destroy();
});

d('workflow order-created (Jobs Queue oficial)', () => {
  it('procesa el pedido: registra log con id varchar, setea trelloCardUrl y completa el job', async () => {
    // Pedido directo vía Local API (el checkout ya valida precios server-side)
    const order = await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        status: 'pending',
        orderNumber: `TEST-${Date.now()}`,
        customer: { name: 'Cliente Test', phone: '+584121234567', email: 'cliente@test.local' },
        items: [{ sku: 'TEST-SKU', title: 'Producto Test', price: 10, quantity: 2 }],
        totalAmount: 20,
        currency: 'USD',
      } as never,
    });
    createdOrderIds.push(order.id as number);

    // Encola + ejecuta DIRECTO (mismo patrón que el checkout con after())
    const job = await payload.jobs.queue({
      workflow: 'order-created',
      input: { orderId: order.id as number },
    });
    await payload.jobs.runByID({ id: job.id });

    // El job completó sin error (vía SQL: la colección interna no está tipada en el config de test)
    const doneRes = await payload.db.drizzle.execute(
      (await import('@payloadcms/db-postgres/drizzle')).sql`SELECT completed_at FROM payload_jobs WHERE id = ${job.id}`
    );
    // Diagnóstico completo del job en caso de fallo
    if (!doneRes.rows[0]?.completed_at) {
      const diag = await payload.db.drizzle.execute(
        (await import('@payloadcms/db-postgres/drizzle')).sql`SELECT * FROM payload_jobs WHERE id = ${job.id}`
      );
      console.log('JOB STATE:', JSON.stringify(diag.rows[0], null, 2));
    }
    expect(doneRes.rows[0]?.completed_at).toBeTruthy();

    // El pedido quedó marcado con la tarjeta de Trello (mock)
    const updated = await payload.findByID({
      collection: 'orders',
      id: order.id as number,
      overrideAccess: true,
      depth: 0,
    });
    expect(String((updated as unknown as { trelloCardUrl?: string }).trelloCardUrl)).toContain(
      'mock-card-'
    );

    // El log del job insertó filas con ID VARCHAR (regresión del bug task_i_d/id integer)
    const logs = await payload.db.drizzle.execute(
      // eslint-disable-next-line
      (await import('@payloadcms/db-postgres/drizzle')).sql`SELECT COUNT(*)::int AS n FROM payload_jobs_log WHERE _parent_id = ${job.id} AND state = 'succeeded'`
    );
    expect(Number((logs.rows[0] as { n: number }).n)).toBeGreaterThan(0);
  }, 60000);

  it('la tabla hija usa ids varchar (regresión del bug SERIAL)', async () => {
    const res = await payload.db.drizzle.execute(
      // eslint-disable-next-line
      (await import('@payloadcms/db-postgres/drizzle')).sql`SELECT data_type FROM information_schema.columns WHERE table_name='payload_jobs_log' AND column_name='id'`
    );
    expect(String((res.rows[0] as { data_type: string }).data_type)).toBe('character varying');
  });
});
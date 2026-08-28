import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import config from '../payload.config';

/**
 * Regresión de dos brechas señaladas en las auditorías previas y nunca
 * cerradas con un test de integración real (contra Postgres, no mocks):
 *
 * 1. V-H1 (AUDITORIA_REVALIDADA_2026-08-25 §V-H1): "Test faltante: integración
 *    que compre por SKU de variante y afirme qué campo decreció." Este test
 *    compra por SKU de variante y verifica que SOLO la fila de la variante
 *    en products_variants decrece — el stock base del producto no se toca.
 * 2. Degradación de integraciones opcionales: un tenant sin trelloConfig ni
 *    emailConfig (caso real de alta mínima, ver docs/GUIA_GESTION_FLOW.md)
 *    debe poder completar el workflow order-created sin lanzar ni bloquear
 *    el pedido — Trello se salta limpiamente por falta de listId.
 *
 * Mocks de integraciones externas: cero red real en tests (mismo patrón que
 * tests/int/order-workflow.test.ts).
 */
vi.mock('../../src/lib/trello', () => ({
  createTrelloOrderCard: vi.fn(async (p: { orderNumber: string }) => ({
    success: true,
    cardId: `mock-card-${p.orderNumber}`,
  })),
}));
vi.mock('../../src/lib/delivery-note', () => ({
  getDeliveryNoteUrl: vi.fn(async () => null),
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

  // Tenant deliberadamente MÍNIMO: sin trelloConfig ni emailConfig. Es el
  // estado real de un comercio recién dado de alta antes de completar el
  // paso 4/5 de docs/GUIA_GESTION_FLOW.md.
  const tenant = await payload.create({
    collection: 'tenants',
    overrideAccess: true,
    data: {
      name: 'Tienda Lifecycle Test',
      slug: `lifecycle-${Date.now()}`,
      whatsappPhone: '+584120000000',
    } as never,
  });
  tenantId = tenant.id as number;

  const product = await payload.create({
    collection: 'products',
    overrideAccess: true,
    data: {
      tenant: tenantId,
      title: 'Camiseta Test',
      price: 15,
      sku: 'CAMISETA-BASE',
      trackStock: true,
      stockQuantity: 3,
      stockStatus: 'in_stock',
      variants: [
        { name: 'M', sku: 'CAMISETA-M', price: 15, stockQuantity: 8, stockStatus: 'in_stock' },
        { name: 'L', sku: 'CAMISETA-L', price: 15, stockQuantity: 5, stockStatus: 'in_stock' },
      ],
    } as never,
  });
  productId = product.id as number;
}, 120000);

afterAll(async () => {
  for (const id of createdOrderIds) {
    await payload.delete({ collection: 'orders', id, overrideAccess: true }).catch(() => null);
  }
  await payload.delete({ collection: 'products', id: productId, overrideAccess: true }).catch(() => null);
  await payload.delete({ collection: 'tenants', id: tenantId, overrideAccess: true }).catch(() => null);
  await payload.destroy();
});

d('ciclo de vida del pedido: inventario por variante + degradación sin Trello/email', () => {
  it('descuenta SOLO la fila de la variante vendida (V-H1), el stock base queda intacto', async () => {
    const order = await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        status: 'pending',
        orderNumber: `LIFECYCLE-${Date.now()}`,
        customer: { name: 'Cliente Test', phone: '+584121234567', email: 'cliente@test.local' },
        items: [{ sku: 'CAMISETA-L', title: 'Camiseta Test - L', price: 15, quantity: 2 }],
        totalAmount: 30,
        currency: 'USD',
      } as never,
    });
    createdOrderIds.push(order.id as number);

    const product = (await payload.findByID({
      collection: 'products',
      id: productId,
      overrideAccess: true,
      depth: 0,
    })) as unknown as {
      stockQuantity?: number;
      variants?: Array<{ sku?: string; stockQuantity?: number }>;
    };

    // Variante L: 5 - 2 = 3
    const variantL = product.variants?.find((v) => v.sku === 'CAMISETA-L');
    expect(variantL?.stockQuantity).toBe(3);
    // Variante M no se tocó
    const variantM = product.variants?.find((v) => v.sku === 'CAMISETA-M');
    expect(variantM?.stockQuantity).toBe(8);
    // Stock BASE intacto: la venta fue por variante, no por el SKU base.
    expect(product.stockQuantity).toBe(3);
  });

  it('rechaza la venta si la variante no tiene stock suficiente (sin sobreventa)', async () => {
    await expect(
      payload.create({
        collection: 'orders',
        overrideAccess: true,
        data: {
          tenant: tenantId,
          status: 'pending',
          orderNumber: `LIFECYCLE-OOS-${Date.now()}`,
          customer: { name: 'Cliente Test 2', phone: '+584121234568', email: 'cliente2@test.local' },
          items: [{ sku: 'CAMISETA-M', title: 'Camiseta Test - M', price: 15, quantity: 999 }],
          totalAmount: 14985,
          currency: 'USD',
        } as never,
      })
    ).rejects.toThrow();
  });

  it('el workflow order-created se salta Trello limpiamente si el tenant no configuró listId', async () => {
    const order = await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        status: 'pending',
        orderNumber: `LIFECYCLE-JOB-${Date.now()}`,
        customer: { name: 'Cliente Sin Config', phone: '+584121234569', email: 'sinconfig@test.local' },
        items: [{ sku: 'CAMISETA-M', title: 'Camiseta Test - M', price: 15, quantity: 1 }],
        totalAmount: 15,
        currency: 'USD',
      } as never,
    });
    createdOrderIds.push(order.id as number);

    const job = await payload.jobs.queue({
      workflow: 'order-created',
      input: { orderId: order.id as number },
    });
    await payload.jobs.runByID({ id: job.id });

    const { sql } = await import('@payloadcms/db-postgres/drizzle');
    const doneRes = await payload.db.drizzle.execute(
      sql`SELECT completed_at FROM payload_jobs WHERE id = ${job.id}`
    );
    expect(doneRes.rows[0]?.completed_at).toBeTruthy();

    // Sin trelloConfig.listId -> se salta el despacho, no se crea tarjeta ni
    // se rompe el job ni el pedido.
    const updated = await payload.findByID({
      collection: 'orders',
      id: order.id as number,
      overrideAccess: true,
      depth: 0,
    });
    expect((updated as unknown as { trelloCardUrl?: string }).trelloCardUrl).toBeFalsy();
    expect((updated as unknown as { emailConfirmationSent?: boolean }).emailConfirmationSent).toBe(true);
  }, 60000);
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import config from '../payload.config';

/**
 * PR 4.3 (plan sprints 2026-09-09, H-3): cotas de texto del comprador.
 * El comprador anónimo es un writer NO confiable: sin cotas, MB de texto
 * en nombre/dirección/notas llegaban intactos al PDF (R2), la card de
 * Trello y el WhatsApp del comercio. La Server Action valida en el
 * boundary (fail-fast, ver checkout.ts) Y el schema de Orders aplica la
 * misma cota a TODO writer (incluido admin/REST) — esta doble capa es el
 * patrón ya usado para deliveryType/methodKey (PR 4, auditoría 09-07 A6).
 *
 * Este test ejercita la capa de SCHEMA: payload.create con strings por
 * encima de la cota debe ser rechazado por la validación de maxLength de
 * Payload (Runtime API oficial — sin mocks).
 */

const runIntegration = !!process.env.TEST_DATABASE_URI;
const d = runIntegration ? describe : describe.skip;

let payload: Payload;
let tenantId: number;

beforeAll(async () => {
  payload = await getPayload({ config: config as never });
  const tenant = await payload.create({
    collection: 'tenants',
    overrideAccess: true,
    data: {
      name: 'Tienda Cotas Test',
      slug: `cotas-${Date.now()}`,
      whatsappPhone: '+584120000000',
    } as never,
  });
  tenantId = tenant.id as number;
}, 120000);

afterAll(async () => {
  await payload.delete({ collection: 'tenants', id: tenantId, overrideAccess: true }).catch(() => null);
  await payload.destroy();
});

const baseOrder = (overrides: Record<string, unknown>) => ({
  tenant: tenantId,
  status: 'pending',
  orderNumber: `COTAS-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
  customer: {
    name: 'Cliente Cotas',
    phone: '+584121234567',
    email: 'cotas@test.local',
    ...overrides,
  },
  items: [{ sku: 'X', title: 'Producto', price: 1, quantity: 1 }],
  totalAmount: 1,
  currency: 'USD',
});

d('cotas de texto del comprador (PR 4.3, H-3) — capa schema', () => {
  it('rechaza name de 10k chars (maxLength 120)', async () => {
    await expect(
      payload.create({
        collection: 'orders',
        overrideAccess: true,
        data: baseOrder({ name: 'A'.repeat(10_000) }) as never,
      })
    ).rejects.toThrow();
  });

  it('rechaza address de 10k chars (maxLength 500)', async () => {
    await expect(
      payload.create({
        collection: 'orders',
        overrideAccess: true,
        data: baseOrder({ address: 'B'.repeat(10_000) }) as never,
      })
    ).rejects.toThrow();
  });

  it('rechaza notes de 10k chars (maxLength 1000)', async () => {
    await expect(
      payload.create({
        collection: 'orders',
        overrideAccess: true,
        data: baseOrder({ notes: 'C'.repeat(10_000) }) as never,
      })
    ).rejects.toThrow();
  });

  it('acepta textos legítimos dentro de las cotas (no rompe pedidos reales)', async () => {
    const order = await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: baseOrder({
        name: 'María Fernández de los Ríos', // 27 chars — holgado
        address: 'Av. Principal, Edif. Torre A, Apto 12-B, Los Palos Grandes, Caracas',
        notes: 'Tocar el timbre 12-B, dejar con el portero si no estoy. Gracias.',
      }) as never,
    });
    expect(order.id).toBeDefined();
    await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true });
  });
});

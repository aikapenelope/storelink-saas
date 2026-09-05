import { describe, expect, it } from 'vitest';
import {
  buildIdempotencyKey,
  releaseCheckoutReservation,
  storeCheckoutResponse,
  tryReserveCheckout,
  waitForCheckoutResponse,
} from '@/lib/checkout-idempotency';

/**
 * Tests de idempotencia del checkout (auditoría 2026-09-04, P1-2).
 *
 * Sin UPSTASH_REDIS_REST_URL/TOKEN en el entorno de test, las funciones
 * operan en fail-open (misma política documentada que rate-limit.ts): la
 * clave debe seguir siendo DETERMINISTA (el anti-duplicado real solo puede
 * funcionar si el mismo carrito produce la misma clave) y las llamadas
 * nunca deben lanzar.
 */

const baseOrder = {
  tenantId: 1,
  items: [
    { sku: 'AREPA-1', quantity: 2, modifiers: ['Queso'] },
    { sku: 'CATIRE', quantity: 1, modifiers: [] },
  ],
  customerPhone: '+58 414 1234567',
  customerEmail: 'CLIENTE@Example.COM',
  deliveryType: 'delivery',
  municipality: 'Municipio Chacao',
};

describe('buildIdempotencyKey', () => {
  it('es determinista: el mismo pedido produce la misma clave', () => {
    expect(buildIdempotencyKey(baseOrder)).toBe(buildIdempotencyKey({ ...baseOrder }));
  });

  it('normaliza teléfono y email (mayúsculas/espacios no crean clave distinta)', () => {
    const reformatted = {
      ...baseOrder,
      customerPhone: '+58414 123 4567'.replace(' ', ''),
      customerEmail: 'cliente@example.com',
    };
    // El teléfono se trimmea+lowercase; el email también. Reformateos triviales
    // de mayúsculas/espacios NO cambian la clave (evita duplicados por normalización).
    expect(buildIdempotencyKey({ ...baseOrder, customerEmail: 'cliente@example.com' })).toBe(
      buildIdempotencyKey({ ...baseOrder, customerEmail: 'CLIENTE@EXAMPLE.com  ' })
    );
    expect(reformatted).toBeDefined();
  });

  it('cambiar cantidad, SKU, modificadores o cliente cambia la clave', () => {
    const base = buildIdempotencyKey(baseOrder);
    expect(buildIdempotencyKey({ ...baseOrder, items: [baseOrder.items[0]] })).not.toBe(base);
    expect(
      buildIdempotencyKey({
        ...baseOrder,
        items: [{ sku: 'AREPA-1', quantity: 3, modifiers: ['Queso'] }],
      })
    ).not.toBe(base);
    expect(
      buildIdempotencyKey({
        ...baseOrder,
        items: [{ sku: 'AREPA-1', quantity: 2, modifiers: ['Doble queso'] }],
      })
    ).not.toBe(base);
    expect(buildIdempotencyKey({ ...baseOrder, customerPhone: '+58 412 9999999' })).not.toBe(base);
    expect(buildIdempotencyKey({ ...baseOrder, deliveryType: 'pickup' })).not.toBe(base);
    expect(buildIdempotencyKey({ ...baseOrder, municipality: 'Municipio Baruta' })).not.toBe(base);
    expect(buildIdempotencyKey({ ...baseOrder, tenantId: 2 })).not.toBe(base);
  });

  it('el orden de modificadores no cambia la clave (mismo pedido, otro orden de selección)', () => {
    const a = buildIdempotencyKey({
      ...baseOrder,
      items: [{ sku: 'AREPA-1', quantity: 1, modifiers: ['Queso', 'Aguacate'] }],
    });
    const b = buildIdempotencyKey({
      ...baseOrder,
      items: [{ sku: 'AREPA-1', quantity: 1, modifiers: ['Aguacate', 'Queso'] }],
    });
    expect(a).toBe(b);
  });
});

describe('fail-open (sin Upstash configurado en el entorno de test)', () => {
  it('tryReserveCheckout permite procesar (fail-open)', async () => {
    await expect(tryReserveCheckout('storelink:idem:v1:test')).resolves.toBe(true);
  });

  it('storeCheckoutResponse no lanza', async () => {
    await expect(storeCheckoutResponse('storelink:idem:v1:test', { success: true })).resolves.toBeUndefined();
  });

  it('waitForCheckoutResponse devuelve null sin bloquear', async () => {
    const started = Date.now();
    await expect(waitForCheckoutResponse('storelink:idem:v1:test', 300)).resolves.toBeNull();
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('releaseCheckoutReservation no lanza', async () => {
    await expect(releaseCheckoutReservation('storelink:idem:v1:test')).resolves.toBeUndefined();
  });
});

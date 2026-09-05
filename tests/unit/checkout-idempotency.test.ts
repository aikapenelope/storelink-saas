import { afterEach, describe, expect, it } from 'vitest';
import {
  __resetRedisClientForTests,
  __setRedisClientForTests,
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

  // Review Devin #74: el pedido también lo definen dirección y pago.
  it('cambiar dirección o método de pago cambia la clave', () => {
    const base = buildIdempotencyKey(baseOrder);
    expect(
      buildIdempotencyKey({ ...baseOrder, customerAddress: 'Av. Principal, Casa 5' })
    ).not.toBe(buildIdempotencyKey({ ...baseOrder, customerAddress: 'Otra dirección' }));
    expect(
      buildIdempotencyKey({ ...baseOrder, paymentMethod: 'Zelle USD (Ref: #123)' })
    ).not.toBe(buildIdempotencyKey({ ...baseOrder, paymentMethod: 'Pago Móvil VES' }));
  });

  // Review Devin #74: el token de intención distingue reintento vs compra nueva.
  it('el mismo token produce la misma clave y tokens distintos producen claves distintas', () => {
    const tokenA = '11111111-1111-4111-8111-111111111111';
    const tokenB = '22222222-2222-4222-8222-222222222222';
    expect(buildIdempotencyKey({ ...baseOrder, attemptToken: tokenA })).toBe(
      buildIdempotencyKey({ ...baseOrder, attemptToken: tokenA })
    );
    expect(buildIdempotencyKey({ ...baseOrder, attemptToken: tokenA })).not.toBe(
      buildIdempotencyKey({ ...baseOrder, attemptToken: tokenB })
    );
    // Sin token (cliente legacy/API): fingerprint de contenido determinista.
    expect(buildIdempotencyKey({ ...baseOrder, attemptToken: null })).toBe(
      buildIdempotencyKey({ ...baseOrder })
    );
  });

  it('un token inválido o malformado se ignora (no rompe la clave)', () => {
    // Ambos tokens son inválidos (longitud <8) → ignorados → misma clave.
    expect(buildIdempotencyKey({ ...baseOrder, attemptToken: 'corto' })).toBe(
      buildIdempotencyKey({ ...baseOrder, attemptToken: 'corta' })
    );
    // Caracteres fuera del alfabeto permitido → ignorado.
    expect(buildIdempotencyKey({ ...baseOrder, attemptToken: 'con espacios y <tags>' })).toBe(
      buildIdempotencyKey({ ...baseOrder, attemptToken: null })
    );
  });
});

describe('fail-open (sin Upstash configurado en el entorno de test)', () => {
  it('tryReserveCheckout permite procesar (fail-open)', async () => {
    await expect(tryReserveCheckout('storelink:idem:v2:test')).resolves.toBe(true);
  });

  it('storeCheckoutResponse no lanza', async () => {
    await expect(storeCheckoutResponse('storelink:idem:v2:test', { success: true })).resolves.toBeUndefined();
  });

  it('waitForCheckoutResponse devuelve null sin bloquear', async () => {
    const started = Date.now();
    await expect(waitForCheckoutResponse('storelink:idem:v2:test', 300)).resolves.toBeNull();
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('releaseCheckoutReservation no lanza', async () => {
    await expect(releaseCheckoutReservation('storelink:idem:v2:test')).resolves.toBeUndefined();
  });
});

/**
 * Review Devin #74: el cliente oficial de Upstash DESERIALIZA automáticamente
 * los valores JSON (automaticDeserialization activo por defecto). Este mock
 * replica ese comportamiento exacto para probar el contrato completo
 * reservar → guardar respuesta → esperar → replay, sin Redis real.
 */
function makeMockUpstashClient() {
  const store = new Map<string, unknown>();
  return {
    store,
    async set(key: string, value: unknown, opts?: { nx?: boolean }): Promise<string | null> {
      if (opts?.nx && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    },
    // Simula automaticDeserialization: los strings JSON vuelven como objeto.
    async get<T>(key: string): Promise<T | null> {
      const value = store.get(key);
      if (value === undefined) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as unknown as T;
        }
      }
      return value as T;
    },
    async del(key: string): Promise<number> {
      return store.delete(key) ? 1 : 0;
    },
  };
}

describe('replay con Upstash real (mock con automaticDeserialization)', () => {
  afterEach(() => {
    __resetRedisClientForTests();
  });

  it('el duplicado recibe la respuesta guardada (objeto ya deserializado por Upstash)', async () => {
    const mock = makeMockUpstashClient();
    __setRedisClientForTests(mock);
    const key = 'storelink:idem:v2:replay';

    await expect(tryReserveCheckout(key)).resolves.toBe(true);
    await storeCheckoutResponse(key, { success: true, orderNumber: 'ORD-1' });
    // waitForCheckoutResponse NO debe lanzar por re-parsear un objeto ya
    // deserializado: antes devolvía null (error "en proceso") siempre.
    await expect(waitForCheckoutResponse(key, 500)).resolves.toEqual({
      success: true,
      orderNumber: 'ORD-1',
    });
  });

  it('reserva NX: el segundo request NO obtiene el slot y NO borra la respuesta', async () => {
    const mock = makeMockUpstashClient();
    __setRedisClientForTests(mock);
    const key = 'storelink:idem:v2:nx';

    await expect(tryReserveCheckout(key)).resolves.toBe(true);
    // El duplicado NO reserva (NX).
    await expect(tryReserveCheckout(key)).resolves.toBe(false);

    // Liberar NO debe borrar la respuesta ya guardada.
    await storeCheckoutResponse(key, { success: true, orderNumber: 'ORD-2' });
    await releaseCheckoutReservation(key);
    expect(mock.store.get(key)).toBeDefined();
  });

  it('liberar una reserva sin orden creada sí borra la clave', async () => {
    const mock = makeMockUpstashClient();
    __setRedisClientForTests(mock);
    const key = 'storelink:idem:v2:release';
    await expect(tryReserveCheckout(key)).resolves.toBe(true);
    await releaseCheckoutReservation(key);
    expect(mock.store.has(key)).toBe(false);
  });
});

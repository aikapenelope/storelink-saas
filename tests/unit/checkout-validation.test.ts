import { describe, expect, it } from 'vitest';
import {
  buildPickupAddress,
  normalizeCheckoutCustomer,
  validateCheckoutInput,
  type CheckoutRequest,
} from '@/lib/checkout-validation';

/**
 * Flags Devin #116 (3ª ronda) que este suite clava:
 *  - «Whitespace bypasses boundary text caps»: el boundary medía
 *    trim().length pero la orden persistía el string sin trim → "Casa 4" +
 *    10k espacios pasaba y moría en el create tras pricing/tasa.
 *  - «Pickup configuration blocks valid checkout»: la dirección pickup la
 *    armaba el drawer desde config del tenant sin cotas → una config larga
 *    bloqueaba todos los checkouts pickup.
 *
 * Flujo real de la Server Action: normalizeCheckoutCustomer (0bis) →
 * validateCheckoutInput (1) → buildPickupAddress (2bis si pickup) → create.
 * Los tests reproducen ese orden exacto — sin mocks, funciones puras.
 */

const baseRequest = (customerOverrides: Record<string, unknown> = {}): CheckoutRequest => ({
  tenantSlug: 'don-luigi',
  storeName: 'Don Luigi',
  currency: 'USD',
  checkoutNonce: 'nonce-x',
  items: [{ sku: 'X', title: 'Producto', quantity: 1, price: 1 }],
  customer: {
    name: 'María Fernández',
    phone: '+58 412 1234567',
    email: 'maria@test.local',
    address: 'Av. Principal, Los Palos Grandes',
    deliveryType: 'delivery',
    ...customerOverrides,
  } as CheckoutRequest['customer'],
});

/** Recorre el pipeline real de la Action: normalizar → validar. */
const pipeline = (overrides: Record<string, unknown> = {}) =>
  validateCheckoutInput({
    ...baseRequest(overrides),
    customer: normalizeCheckoutCustomer(baseRequest(overrides).customer),
  });

describe('normalizeCheckoutCustomer — flag Devin #116 «Whitespace bypasses boundary text caps»', () => {
  it('el whitespace de cola/punta se elimina ANTES de validar: 10k espacios tras "Casa 4" ya no pasan como dirección corta', () => {
    const padded = `Casa 4${' '.repeat(10_000)}`;
    // Normalización: el string persistible es "Casa 4" (6 chars)
    const normalized = normalizeCheckoutCustomer(baseRequest({ address: padded }).customer);
    expect(normalized.address).toBe('Casa 4');
    // Y el boundary sobre la copia normalizada pasa (es una dirección corta)
    expect(pipeline({ address: padded }).ok).toBe(true);
  });

  it('cota sobre el valor NORMALIZADO: name de 200 chars reales NO se trunca — el boundary lo rechaza con mensaje visible', () => {
    const longName = 'A'.repeat(200);
    const normalized = normalizeCheckoutCustomer(baseRequest({ name: longName }).customer);
    // La normalización NO trunca (una dirección truncada no es entregable):
    // preserva el texto real para que el boundary lo rechace explícitamente.
    expect(normalized.name.length).toBe(200);
    expect(pipeline({ name: longName })).toEqual({ ok: false, error: 'El nombre es demasiado largo' });
  });

  it('una string de MB muere fail-fast en el boundary — ANTES de guards/pricing/tasa/PDF', () => {
    const mega = 'X'.repeat(2_000_000);
    expect(pipeline({ notes: mega })).toEqual({ ok: false, error: 'Las notas son demasiado largas' });
    expect(pipeline({ address: mega })).toEqual({ ok: false, error: 'La dirección es demasiado larga' });
  });

  it('subcampos de entrega vacíos tras trim se omiten (no persiste strings en blanco)', () => {
    const normalized = normalizeCheckoutCustomer(
      baseRequest({
        deliveryDetails: {
          municipality: '  Chacao  ',
          residenceZone: '   ',
          buildingHouse: '',
          referencePoint: undefined,
        },
      }).customer,
    );
    expect(normalized.deliveryDetails).toEqual({
      municipality: 'Chacao',
      residenceZone: undefined,
      buildingHouse: undefined,
      referencePoint: undefined,
    });
  });

  it('campos requeridos: sin name/phone/email el boundary falla con el mismo mensaje de UI', () => {
    const res = pipeline({ name: '   ', phone: '+584121234567', email: 'x@y.co' });
    expect(res).toEqual({ ok: false, error: 'Por favor completa el nombre, teléfono y correo de contacto' });
  });
});

describe('validateCheckoutInput — cotas espejo del schema de Orders', () => {
  it('items null/undefined: shape-check ANTES que la cota — error controlado, no TypeError (flag Devin #116 r4)', () => {
    const req = baseRequest();
    // @ts-expect-error: caso hostil real — el request puede traer cualquier shape
    req.items = null;
    expect(validateCheckoutInput(req)).toEqual({ ok: false, error: 'El carrito está vacío' });
    // @ts-expect-error: ídem sin el campo
    delete req.items;
    expect(validateCheckoutInput(req)).toEqual({ ok: false, error: 'El carrito está vacío' });
  });

  it('carrito sobre la cota (MAX_CHECKOUT_ITEMS de src/lib/constants.ts) → rechazo fail-fast', () => {
    const req = baseRequest();
    req.items = Array.from({ length: 31 }, () => ({
      sku: 'X',
      title: 'Producto',
      quantity: 1,
      price: 1,
    }));
    const res = validateCheckoutInput(req);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('Demasiados artículos');
  });

  it('address delivery de 10k chars (ya normalizada excede 600) → rechazo fail-fast', () => {
    const res = pipeline({ address: 'A'.repeat(10_000) });
    expect(res).toEqual({ ok: false, error: 'La dirección es demasiado larga' });
  });

  it('worst case legítimo del agregado delivery (~563 chars) pasa — no rompe pedidos reales', () => {
    const address = `[DELIVERY] Dirección/Zona: ${'A'.repeat(200)}, Edif/Casa: ${'B'.repeat(200)}, ${'C'.repeat(120)}`;
    expect(address.length).toBeLessThanOrEqual(600);
    expect(pipeline({ address }).ok).toBe(true);
  });

  it('etiqueta de pago agregada del peor caso (~440 chars) pasa', () => {
    const paymentMethod = `Pago Móvil VES (Banco Emisor: ${'B'.repeat(200)}, Ref: #${'R'.repeat(200)})`;
    expect(paymentMethod.length).toBeLessThanOrEqual(500);
    expect(pipeline({ paymentMethod }).ok).toBe(true);
  });

  it('pickup con address ENORME del request: la cota de address NO se aplica (el servidor la reconstruye)', () => {
    const res = pipeline({ deliveryType: 'pickup', address: 'P'.repeat(10_000) });
    // El boundary ignora la dirección del comprador en pickup (2bis la
    // reemplaza desde tenantDoc). Que el request traiga cualquier cosa NO
    // puede bloquear un checkout pickup válido.
    expect(res.ok).toBe(true);
  });
});

describe('buildPickupAddress — flag Devin #116 «Pickup configuration blocks valid checkout»', () => {
  it('construye desde la config del tenant con defaults idénticos al drawer', () => {
    const addr = buildPickupAddress({ name: 'Don Luigi' }, undefined);
    expect(addr).toBe('[RETIRO EN TIENDA / PICKUP] Don Luigi - Sede Principal (Horario: Lun-Dom 11:30 AM - 10:00 PM)');
  });

  it('usa locationAddress/schedule del tenant cuando existen', () => {
    const addr = buildPickupAddress(
      { name: 'Don Luigi' },
      { locationAddress: 'Av. Orinoco, Local 4, Las Mercedes', schedule: 'Lun-Vie 8:00 AM - 5:00 PM' },
    );
    expect(addr).toBe(
      '[RETIRO EN TIENDA / PICKUP] Av. Orinoco, Local 4, Las Mercedes (Horario: Lun-Vie 8:00 AM - 5:00 PM)',
    );
  });

  it('worst case de cotas del schema (400+150+etiquetas 42=592) cabe en la cota 600 de Orders.customer.address', () => {
    const addr = buildPickupAddress(
      { name: 'X' },
      { locationAddress: 'L'.repeat(400), schedule: 'S'.repeat(150) },
    );
    expect(addr.length).toBeLessThanOrEqual(600);
  });

  it('config legada por encima de cotas: trunca a 600 (nunca rompe el pedido del comprador)', () => {
    const addr = buildPickupAddress({ name: 'X' }, { locationAddress: 'L'.repeat(5_000), schedule: 'S'.repeat(200) });
    expect(addr.length).toBeLessThanOrEqual(600);
    expect(addr.startsWith('[RETIRO EN TIENDA / PICKUP]')).toBe(true);
  });

  it('config con whitespace sucio se normaliza antes de armar el texto', () => {
    const addr = buildPickupAddress(
      { name: 'Don Luigi' },
      { locationAddress: '  Av. Orinoco, Local 4  ', schedule: '  Lun-Vie 8:00 AM - 5:00 PM  ' },
    );
    expect(addr).toBe(
      '[RETIRO EN TIENDA / PICKUP] Av. Orinoco, Local 4 (Horario: Lun-Vie 8:00 AM - 5:00 PM)',
    );
  });
});

describe('items validation — flag Devin #116 «Missing items skip cart validation»', () => {
  it('rechaza con error de carrito si items es undefined o null sin arrojar excepción', () => {
    // @ts-expect-error probando input hostil/inválido en runtime
    const resUndefined = validateCheckoutInput({ ...baseRequest(), items: undefined });
    expect(resUndefined).toEqual({ ok: false, error: 'El carrito está vacío' });

    // @ts-expect-error probando input hostil/inválido en runtime
    const resNull = validateCheckoutInput({ ...baseRequest(), items: null });
    expect(resNull).toEqual({ ok: false, error: 'El carrito está vacío' });
  });

  it('rechaza si items es un array vacío', () => {
    const res = validateCheckoutInput({ ...baseRequest(), items: [] });
    expect(res).toEqual({ ok: false, error: 'El carrito está vacío' });
  });
});

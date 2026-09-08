import { describe, expect, it } from 'vitest';
import {
  normalizePaymentDetails,
  validateCurrencyCode,
  validateDeliveryTypeEnum,
  validateMethodKeyEnum,
} from '../../src/lib/checkout-sanitize';

describe('normalizePaymentDetails', () => {
  it('fuerza paymentStatus pending_verification aunque el cliente envíe verified/rejected', () => {
    const verified = normalizePaymentDetails({ methodKey: 'pago_movil', paymentStatus: 'verified' });
    expect(verified?.paymentStatus).toBe('pending_verification');
    expect(verified?.methodKey).toBe('pago_movil');

    const rejected = normalizePaymentDetails({ methodKey: 'zelle', paymentStatus: 'rejected' });
    expect(rejected?.paymentStatus).toBe('pending_verification');
  });

  it('descarta claves desconocidas del cliente (whitelist)', () => {
    const out = normalizePaymentDetails({ methodKey: 'zelle', rogueField: 'x', amount: 999 });
    expect(out).not.toHaveProperty('rogueField');
    expect(out).not.toHaveProperty('amount');
    expect(out?.methodKey).toBe('zelle');
  });

  it('rechaza methodKey fuera del catálogo de métodos habilitados', () => {
    const out = normalizePaymentDetails({ methodKey: 'paypal' });
    expect(out?.methodKey).toBeUndefined();
    expect(out?.paymentStatus).toBe('pending_verification');
  });

  it('devuelve undefined para entradas no-objeto (null, array, string, number)', () => {
    expect(normalizePaymentDetails(undefined)).toBeUndefined();
    expect(normalizePaymentDetails(null)).toBeUndefined();
    expect(normalizePaymentDetails('pago_movil')).toBeUndefined();
    expect(normalizePaymentDetails(42)).toBeUndefined();
    expect(normalizePaymentDetails(['pago_movil'])).toBeUndefined();
  });

  it('conserva y recorta los campos de texto conocidos a la cota de longitud', () => {
    const longRef = 'R'.repeat(500);
    const out = normalizePaymentDetails({
      methodKey: 'pago_movil',
      referenceNumber: longRef,
      issuingBank: '  Banesco  ',
    });
    expect(out?.referenceNumber).toHaveLength(200);
    expect(out?.issuingBank).toBe('Banesco');
  });

  it('ignora valores no-string en campos de texto', () => {
    const out = normalizePaymentDetails({ referenceNumber: 12345, senderName: { a: 1 } });
    expect(out).not.toHaveProperty('referenceNumber');
    expect(out).not.toHaveProperty('senderName');
  });
});

describe('validateDeliveryTypeEnum (PR 4/A6)', () => {
  it('rechaza valores fuera del catálogo (deliveryType forjado "teleport")', () => {
    expect(validateDeliveryTypeEnum('teleport')).toMatch(/inválida/i);
    expect(validateDeliveryTypeEnum('DRONES')).toMatch(/inválida/i);
    expect(validateDeliveryTypeEnum(1)).toMatch(/inválida/i);
  });

  it('acepta el catálogo y la ausencia (default del create)', () => {
    expect(validateDeliveryTypeEnum('delivery')).toBeNull();
    expect(validateDeliveryTypeEnum('pickup')).toBeNull();
    expect(validateDeliveryTypeEnum(undefined)).toBeNull();
  });
});

describe('validateMethodKeyEnum (PR 4/A6)', () => {
  it('rechaza methodKey fuera del catálogo de métodos', () => {
    expect(validateMethodKeyEnum('paypal')).toMatch(/inválido/i);
    expect(validateMethodKeyEnum('PAGO_MOVIL')).toMatch(/inválido/i); // case-sensitive
  });

  it('acepta los métodos habilitados y la ausencia', () => {
    expect(validateMethodKeyEnum('pago_movil')).toBeNull();
    expect(validateMethodKeyEnum('zelle')).toBeNull();
    expect(validateMethodKeyEnum(undefined)).toBeNull();
    expect(validateMethodKeyEnum('')).toBeNull();
  });
});

describe('validateCurrencyCode (PR 4/A6)', () => {
  it('rechaza monedas con formato no ISO-4217 (inyección en PDF/orden)', () => {
    expect(validateCurrencyCode('USD<script>')).toMatch(/inválida/i);
    expect(validateCurrencyCode('usd')).toMatch(/inválida/i);
    expect(validateCurrencyCode('USDD')).toMatch(/inválida/i);
    expect(validateCurrencyCode('U$D')).toMatch(/inválida/i);
  });

  it('acepta códigos ISO de 3 mayúsculas y la ausencia', () => {
    expect(validateCurrencyCode('USD')).toBeNull();
    expect(validateCurrencyCode('EUR')).toBeNull();
    expect(validateCurrencyCode(undefined)).toBeNull();
  });
});

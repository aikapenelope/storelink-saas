import { describe, expect, it } from 'vitest';
import { normalizePaymentDetails } from '../../src/lib/checkout-sanitize';

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

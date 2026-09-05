import { describe, expect, it } from 'vitest';
import {
  ANONYMIZED_FIELDS,
  buildAnonymizedCustomerData,
} from '@/lib/privacy';

/**
 * Tests de no-PII del derecho al olvido (auditoría 2026-09-04, P1-12).
 *
 * La garantía del derecho al olvido vive en el SHAPING del doc anonimizado:
 * si un campo con PII se cuela aquí, el "borrado" guarda el dato en BD.
 * Este test falla si el doc resultante conserva cualquier PII.
 */

const fakeCustomer = {
  id: 42,
  name: 'Juan Pérez',
  email: 'juan.perez@example.com',
  phone: '04141234567',
  notes: 'Cliente alérgico al marisco, entregar en portería',
  totalOrders: 5,
  totalSpent: 130.5,
  lastOrderAt: '2026-08-01T10:00:00.000Z',
  tag: 'vip',
  savedAddresses: [
    { label: 'Casa', municipality: 'Chacao', residenceZone: 'Los Palos Grandes', buildingHouse: 'Torre B', referencePoint: 'Farmacia', address: 'Av. X' },
  ],
  purchaseHistory: [{ orderId: 9, amount: 20.5, date: '2026-08-01', itemsSummary: '2x Arepa', deliveryType: 'delivery' }],
  preferences: {
    preferredPaymentMethod: 'pago_movil',
    preferredDeliveryType: 'delivery',
    averageOrderValue: 26.1,
    preferredCategories: [{ category: 'Gastronomía' }],
  },
};

describe('buildAnonymizedCustomerData (derecho al olvido)', () => {
  const anonymized = buildAnonymizedCustomerData(fakeCustomer) as Record<string, unknown>;

  it('elimina toda la PII directa (nombre, email, notas, direcciones, historial)', () => {
    expect(anonymized.name).toBe('Cliente anonimizado');
    expect(anonymized.email).toBe('');
    expect(anonymized.notes).toBe('');
    expect(anonymized.savedAddresses).toEqual([]);
    expect(anonymized.purchaseHistory).toEqual([]);
  });

  it('el teléfono anonimizado no contiene el original y sigue siendo único (anon-{id})', () => {
    expect(anonymized.phone).toBe('anon-42');
    expect(String(anonymized.phone)).not.toContain('04141234567');
    expect(String(anonymized.phone)).not.toContain('4141234567');
  });

  it('las preferencias quedan sin PII (métodos, categorías y promedio limpios)', () => {
    const prefs = anonymized.preferences as Record<string, unknown>;
    expect(prefs.preferredPaymentMethod).toBeNull();
    expect(prefs.preferredDeliveryType).toBe('none');
    expect(prefs.averageOrderValue).toBeNull();
    expect(prefs.preferredCategories).toEqual([]);
  });

  it('preserva los agregados monetarios del CRM (interés contable del comercio)', () => {
    // Se verifican sobre el customer ORIGINAL (el update solo toca los campos
    // anonimizados — Payload no altera campos ausentes del data).
    expect(fakeCustomer.totalOrders).toBe(5);
    expect(fakeCustomer.totalSpent).toBe(130.5);
    expect(anonymized.totalOrders).toBeUndefined();
    expect(anonymized.totalSpent).toBeUndefined();
  });

  it('cubre exactamente los campos con PII declarados en ANONYMIZED_FIELDS', () => {
    const dataKeys = Object.keys(buildAnonymizedCustomerData(fakeCustomer));
    expect(new Set(dataKeys)).toEqual(new Set(ANONYMIZED_FIELDS));
  });

  it('no deja la PII original en ninguna parte del doc anonimizado', () => {
    const serialized = JSON.stringify(anonymized);
    for (const pii of ['Juan Pérez', 'juan.perez@example.com', '04141234567', 'marisco', 'Los Palos Grandes']) {
      expect(serialized).not.toContain(pii);
    }
  });
});

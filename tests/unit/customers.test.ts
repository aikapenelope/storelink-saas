import { describe, it, expect } from 'vitest';
import {
  normalizeCustomerPhone,
  buildCustomerWhatsAppUrl,
  computeCustomerSegment,
} from '@/lib/customers';

describe('customers helper (src/lib/customers.ts)', () => {
  describe('normalizeCustomerPhone', () => {
    it('handles empty or non-string gracefully', () => {
      expect(normalizeCustomerPhone('')).toBe('');
      expect(normalizeCustomerPhone('   ')).toBe('');
    });

    it('rejects numbers with fewer than 10 digits or more than 15 digits', () => {
      expect(normalizeCustomerPhone('123')).toBe('');
      expect(normalizeCustomerPhone('12345678')).toBe('');
      expect(normalizeCustomerPhone('123456789')).toBe('');
      expect(normalizeCustomerPhone('1234567890123456')).toBe('');
    });

    it('strips non-digits characters like +, -, spaces, and parentheses', () => {
      expect(normalizeCustomerPhone('+58 (414) 123-4567')).toBe('584141234567');
      expect(normalizeCustomerPhone('0414-555.66.77')).toBe('584145556677');
    });

    it('converts local 10-digit Venezuelan numbers to international format (prepending 58)', () => {
      expect(normalizeCustomerPhone('4141234567')).toBe('584141234567');
      expect(normalizeCustomerPhone('4249876543')).toBe('584249876543');
      expect(normalizeCustomerPhone('4120001122')).toBe('584120001122');
      expect(normalizeCustomerPhone('2121234567')).toBe('582121234567');
    });

    it('strips leading 0 before formatting 10-digit number', () => {
      expect(normalizeCustomerPhone('04141234567')).toBe('584141234567');
      expect(normalizeCustomerPhone('04245554433')).toBe('584245554433');
    });

    it('preserves already prefixed 58 numbers', () => {
      expect(normalizeCustomerPhone('584141234567')).toBe('584141234567');
    });

    it('accepts valid international numbers between 10 and 15 digits', () => {
      expect(normalizeCustomerPhone('14155552671')).toBe('14155552671'); // US 11 digits
      expect(normalizeCustomerPhone('573001234567')).toBe('573001234567'); // Colombia 12 digits
    });
  });

  describe('buildCustomerWhatsAppUrl', () => {
    it('returns empty string if phone is empty or invalid', () => {
      expect(buildCustomerWhatsAppUrl('')).toBe('');
      expect(buildCustomerWhatsAppUrl('123')).toBe('');
    });

    it('builds wa.me URL with clean international phone', () => {
      expect(buildCustomerWhatsAppUrl('04141234567')).toBe('https://wa.me/584141234567');
    });

    it('encodes prefilled message in wa.me URL', () => {
      const url = buildCustomerWhatsAppUrl('4141234567', '¡Hola Juan! ¿Cómo estás?');
      expect(url).toContain('https://wa.me/584141234567?text=');
      expect(url).toContain(encodeURIComponent('¡Hola Juan! ¿Cómo estás?'));
    });
  });

  describe('computeCustomerSegment', () => {
    it('prioritizes inactivo when tag is inactivo or more than 60 days have elapsed', () => {
      expect(computeCustomerSegment({ tag: 'inactivo', totalOrders: 5, totalSpent: 200 })).toBe('inactivo');

      const seventyDaysAgo = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString();
      // Even if customer has 5 orders and $200 spent, if > 60 days inactive -> inactivo
      expect(computeCustomerSegment({ totalOrders: 5, totalSpent: 200, lastOrderAt: seventyDaysAgo })).toBe('inactivo');
      expect(computeCustomerSegment({ totalOrders: 2, totalSpent: 30, lastOrderAt: seventyDaysAgo })).toBe('inactivo');
    });

    it('classifies as VIP if active and tag is explicitly "vip" or orders >= 3 or spent >= 50', () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      expect(computeCustomerSegment({ tag: 'vip', totalOrders: 1, totalSpent: 10, lastOrderAt: fiveDaysAgo })).toBe('vip');
      expect(computeCustomerSegment({ totalOrders: 3, totalSpent: 15, lastOrderAt: fiveDaysAgo })).toBe('vip');
      expect(computeCustomerSegment({ totalOrders: 1, totalSpent: 65, lastOrderAt: fiveDaysAgo })).toBe('vip');
    });

    it('classifies as frecuente if active and totalOrders is 2 or tag is frecuente (and not VIP)', () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      expect(computeCustomerSegment({ totalOrders: 2, totalSpent: 30, lastOrderAt: fiveDaysAgo })).toBe('frecuente');
      expect(computeCustomerSegment({ tag: 'frecuente', totalOrders: 1, totalSpent: 10, lastOrderAt: fiveDaysAgo })).toBe('frecuente');
    });

    it('classifies as nuevo for 0 or 1 order within 60 days', () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      expect(computeCustomerSegment({ totalOrders: 1, totalSpent: 20, lastOrderAt: fiveDaysAgo })).toBe('nuevo');
      expect(computeCustomerSegment({ totalOrders: 0, totalSpent: 0 })).toBe('nuevo');
    });
  });
});

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
  });

  describe('buildCustomerWhatsAppUrl', () => {
    it('returns empty string if phone is empty', () => {
      expect(buildCustomerWhatsAppUrl('')).toBe('');
    });

    it('builds wa.me URL with clean international phone', () => {
      expect(buildCustomerWhatsAppUrl('04141234567')).toBe('https://wa.me/584141234567');
    });

    it('encodes prefilled message in wa.me URL', () => {
      const url = buildCustomerWhatsAppUrl('4141234567', '¡Hola Juan! ¿Cómo estás?');
      expect(url).toBe('https://wa.me/584141234567?text=%C2%A1Hola%20Juan!%20%C2%BFHow%20est%C3%A1s%3F'.replace('How', 'C%C3%B3mo'));
      expect(url).toContain('https://wa.me/584141234567?text=');
      expect(url).toContain(encodeURIComponent('¡Hola Juan! ¿Cómo estás?'));
    });
  });

  describe('computeCustomerSegment', () => {
    it('classifies as VIP if tag is explicitly "vip"', () => {
      expect(computeCustomerSegment({ tag: 'vip', totalOrders: 1, totalSpent: 10 })).toBe('vip');
    });

    it('classifies as VIP if totalOrders >= 3 or totalSpent >= 50', () => {
      expect(computeCustomerSegment({ totalOrders: 3, totalSpent: 15 })).toBe('vip');
      expect(computeCustomerSegment({ totalOrders: 1, totalSpent: 65 })).toBe('vip');
    });

    it('classifies as frecuente if totalOrders is 2 or tag is frecuente', () => {
      expect(computeCustomerSegment({ totalOrders: 2, totalSpent: 30 })).toBe('frecuente');
      expect(computeCustomerSegment({ tag: 'frecuente', totalOrders: 1, totalSpent: 10 })).toBe('frecuente');
    });

    it('classifies as inactivo if tag is inactivo or more than 60 days without orders', () => {
      expect(computeCustomerSegment({ tag: 'inactivo', totalOrders: 1, totalSpent: 10 })).toBe('inactivo');

      const seventyDaysAgo = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString();
      expect(computeCustomerSegment({ totalOrders: 1, totalSpent: 20, lastOrderAt: seventyDaysAgo })).toBe('inactivo');
    });

    it('classifies as nuevo for 0 or 1 order within 60 days', () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      expect(computeCustomerSegment({ totalOrders: 1, totalSpent: 20, lastOrderAt: fiveDaysAgo })).toBe('nuevo');
      expect(computeCustomerSegment({ totalOrders: 0, totalSpent: 0 })).toBe('nuevo');
    });
  });
});

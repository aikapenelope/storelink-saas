import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CATALOG_LIMIT,
  PLAN_CATALOG_LIMITS,
  describeCatalogLimit,
  getCatalogLimit,
} from '../../src/lib/tenant-plans';

/**
 * Planes de capacidad por tenant (auditoría 2026-09-05, P1-1): el límite de
 * catálogo deja de ser un 500 hardcodeado y pasa a ser configurable por
 * super-admin vía el campo `plan` de Tenants.
 */
describe('tenant-plans', () => {
  it('Plan Básico → 500 productos', () => {
    expect(getCatalogLimit('basico')).toBe(500);
  });

  it('Plan Pro → 2000 productos', () => {
    expect(getCatalogLimit('pro')).toBe(2000);
  });

  it('Sin plan (null/undefined) → límite estándar de 1000', () => {
    expect(getCatalogLimit(null)).toBe(DEFAULT_CATALOG_LIMIT);
    expect(getCatalogLimit(undefined)).toBe(DEFAULT_CATALOG_LIMIT);
    expect(DEFAULT_CATALOG_LIMIT).toBe(1000);
  });

  it('Valor desconocido (plan inválido en BD) → límite estándar, nunca NaN/0', () => {
    expect(getCatalogLimit('premium')).toBe(1000);
    expect(getCatalogLimit('')).toBe(1000);
    expect(getCatalogLimit('BASICO')).toBe(1000); // case-sensitive: solo valores exactos
  });

  it('los números del plan son los publicables', () => {
    expect(PLAN_CATALOG_LIMITS.basico).toBe(500);
    expect(PLAN_CATALOG_LIMITS.pro).toBe(2000);
  });

  it('describeCatalogLimit produce un mensaje legible', () => {
    expect(describeCatalogLimit('basico')).toBe('límite del plan: 500 productos');
    expect(describeCatalogLimit(null)).toBe('límite del plan: 1000 productos');
  });
});

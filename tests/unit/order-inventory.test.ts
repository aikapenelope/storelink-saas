import { describe, expect, it } from 'vitest';
import {
  VARIANTS_TABLE_KEY,
  findVariantIndexBySku,
  variantRowNumber,
} from '@/collections/Orders';
import type { ProductVariant } from '@/payload-types';

/**
 * Tests del fix V-H1: la venta por SKU de variante debe resolver la FILA
 * correcta de products_variants. Helpers puros, sin runtime de Payload.
 */

const variants: ProductVariant[] = [
  { name: 'M', sku: 'TSHIRT-M', price: 10, stockQuantity: 10, stockStatus: 'in_stock' },
  { name: 'L', sku: 'TSHIRT-L', price: 10, stockQuantity: 0, stockStatus: 'in_stock' },
];

describe('findVariantIndexBySku', () => {
  it('resuelve el índice por SKU exacto', () => {
    expect(findVariantIndexBySku(variants, 'TSHIRT-L')).toBe(1);
    expect(findVariantIndexBySku(variants, 'TSHIRT-M')).toBe(0);
  });

  it('devuelve -1 si no hay match', () => {
    expect(findVariantIndexBySku(variants, 'NOEXISTE')).toBe(-1);
  });

  it('devuelve -1 sin SKU o sin variantes', () => {
    expect(findVariantIndexBySku(variants, null)).toBe(-1);
    expect(findVariantIndexBySku(variants, undefined)).toBe(-1);
    expect(findVariantIndexBySku(undefined, 'TSHIRT-M')).toBe(-1);
    expect(findVariantIndexBySku([], 'TSHIRT-M')).toBe(-1);
  });

  it('ignora filas de variante sin SKU y toma la primera coincidencia en duplicados', () => {
    const conDuplicados: ProductVariant[] = [
      { name: 'U', sku: null, price: 10, stockStatus: 'in_stock' },
      { name: 'A', sku: 'DUP', price: 10, stockStatus: 'in_stock' },
      { name: 'B', sku: 'DUP', price: 10, stockStatus: 'in_stock' },
    ];
    expect(findVariantIndexBySku(conDuplicados, 'DUP')).toBe(1);
    expect(findVariantIndexBySku(conDuplicados, null)).toBe(-1);
  });
});

describe('variantRowNumber', () => {
  it('mapea índice de array a _order 1-based', () => {
    expect(variantRowNumber(0)).toBe(1);
    expect(variantRowNumber(4)).toBe(5);
  });

  it('usa la tabla generada del adapter (clave estable)', () => {
    expect(VARIANTS_TABLE_KEY).toBe('products_variants');
  });
});

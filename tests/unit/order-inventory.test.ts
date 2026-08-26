import { describe, expect, it } from 'vitest';
import {
  VARIANTS_TABLE_KEY,
  findVariantIndexBySku,
  variantRowNumber,
} from '@/collections/Orders';

/**
 * Tests del fix V-H1: la venta por SKU de variante debe resolver la FILA
 * correcta de products_variants. Helpers puros, sin runtime de Payload.
 */

type Variant = { name?: string; sku?: string | null; stockQuantity?: number | null };

const variants: Variant[] = [
  { sku: 'TSHIRT-M', stockQuantity: 10 },
  { sku: 'TSHIRT-L', stockQuantity: 0 },
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
    const conDuplicados: Variant[] = [
      { sku: null },
      { sku: 'DUP' },
      { sku: 'DUP' },
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

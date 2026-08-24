import { describe, expect, it } from 'vitest';
import {
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  sanitizeCsvCell,
  validateCsvLimits,
} from '../../src/lib/csv';

describe('sanitizeCsvCell — inyección de fórmulas (OWASP)', () => {
  it('prefija apóstrofe a celdas que empiezan con =', () => {
    expect(sanitizeCsvCell('=HYPERLINK("http://evil","gana")')).toBe(
      '\'=HYPERLINK("http://evil","gana")'
    );
  });

  it('prefija apóstrofe a +, - y @', () => {
    expect(sanitizeCsvCell('+1 555')).toBe("'+1 555");
    expect(sanitizeCsvCell('-50% OFF')).toBe("'-50% OFF");
    expect(sanitizeCsvCell('@cmd')).toBe("'@cmd");
  });

  it('un tab inicial se elimina con el trim: no puede convertirse en fórmula', () => {
    expect(sanitizeCsvCell('\tSUM(A1)')).toBe('SUM(A1)');
  });

  it('no altera celdas inocuas y recorta espacios', () => {
    expect(sanitizeCsvCell('Pizza Familiar')).toBe('Pizza Familiar');
    expect(sanitizeCsvCell('  Talla L ')).toBe('Talla L');
    expect(sanitizeCsvCell('PIZ-001')).toBe('PIZ-001');
  });

  it('normaliza vacíos: null, undefined y solo-espacios devuelven ""', () => {
    expect(sanitizeCsvCell(null)).toBe('');
    expect(sanitizeCsvCell(undefined)).toBe('');
    expect(sanitizeCsvCell('   ')).toBe('');
    expect(sanitizeCsvCell('')).toBe('');
  });

  it('-50% como precio numérico no pasa por aquí (parseo aparte): la celda guardada sí queda neutralizada', () => {
    // Documenta el contrato: los números se parsean con parseFloat ANTES de
    // almacenar; sanitizeCsvCell aplica solo a campos de texto persistidos.
    const stored = sanitizeCsvCell('-50');
    expect(stored.startsWith("'")).toBe(true);
    expect(parseFloat(stored)).toBeNaN();
  });
});

describe('validateCsvLimits — DoS por payload gigante', () => {
  it('acepta un CSV dentro de límites', () => {
    const csv = 'sku,title,price\nA-1,Pizza,10\nB-2,Pasta,12';
    expect(validateCsvLimits(csv)).toEqual({ ok: true });
  });

  it('rechaza CSV mayor a MAX_CSV_BYTES', () => {
    const big = 'x'.repeat(MAX_CSV_BYTES + 1);
    const result = validateCsvLimits(big);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('2 MB');
  });

  it('rechaza más filas de datos que MAX_CSV_ROWS', () => {
    const header = 'sku,title,price';
    const rows = Array.from({ length: MAX_CSV_ROWS + 1 }, (_, i) => `S-${i},P-${i},${i}`).join('\n');
    const result = validateCsvLimits(`${header}\n${rows}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(String(MAX_CSV_ROWS));
  });

  it('usa rowCount del caller si se provee (evita re-partir líneas)', () => {
    const result = validateCsvLimits('sku,title\nA,B', MAX_CSV_ROWS + 5);
    expect(result.ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { sanitizePlainText } from '../../src/lib/order-email';

describe('sanitizePlainText', () => {
  it('elimina saltos de línea: no se pueden inyectar campos falsos en mensajes', () => {
    const out = sanitizePlainText('Cliente\nTOTAL A PAGAR: $0');
    expect(out).toBe('Cliente TOTAL A PAGAR: $0'); // una sola línea, sin \n
    expect(out.startsWith('Cliente ')).toBe(true);
  });

  it('elimina caracteres de control (\\r, \\t, \\u0000)', () => {
    const out = sanitizePlainText('a\rb\tc\u0000d');
    expect(out).toBe('a b cd');
  });

  it('mantiene texto normal intacto', () => {
    expect(sanitizePlainText('Nota simple con acentos: café')).toContain('café');
  });

  it('maneja valores vacíos', () => {
    expect(sanitizePlainText('')).toBe('');
    expect(sanitizePlainText(null)).toBe('');
  });
});
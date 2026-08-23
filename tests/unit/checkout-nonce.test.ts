import { describe, expect, it } from 'vitest';
import {
  checkoutWindowStart,
  issueCheckoutNonce,
  validateCheckoutNonce,
} from '../../src/lib/checkout-nonce';

process.env.CHECKOUT_NONCE_SECRET ||= 'test-secret-anti-abuso-0123456789abcdef';

const WINDOW_MS = 30 * 60 * 1000;
// Instante fijo para determinismo total (sin fake timers)
const NOW = 1_750_000_000_000;

describe('checkout-nonce', () => {
  it('un nonce emitido en la ventana actual valida contra su tenant', () => {
    const nonce = issueCheckoutNonce('tienda-a', NOW);
    expect(validateCheckoutNonce(nonce, 'tienda-a', NOW)).toBe(true);
  });

  it('acepta el nonce de la ventana PREVIA (formularios que cruzan el límite)', () => {
    const previousWindowStart = checkoutWindowStart(NOW) - WINDOW_MS;
    const nonce = issueCheckoutNonce('tienda-a', previousWindowStart);
    expect(validateCheckoutNonce(nonce, 'tienda-a', NOW)).toBe(true);
  });

  it('rechaza un nonce de hace dos ventanas (expirado)', () => {
    const staleWindowStart = checkoutWindowStart(NOW) - 2 * WINDOW_MS;
    const nonce = issueCheckoutNonce('tienda-a', staleWindowStart);
    expect(validateCheckoutNonce(nonce, 'tienda-a', NOW)).toBe(false);
  });

  it('rechaza un nonce reutilizado entre tenants (firma ligada al slug)', () => {
    const nonce = issueCheckoutNonce('tienda-a', NOW);
    expect(validateCheckoutNonce(nonce, 'tienda-b', NOW)).toBe(false);
  });

  it('rechaza una firma alterada (un solo carácter)', () => {
    const nonce = issueCheckoutNonce('tienda-a', NOW);
    const lastChar = nonce.endsWith('a') ? 'b' : 'a';
    expect(validateCheckoutNonce(`${nonce.slice(0, -1)}${lastChar}`, 'tienda-a', NOW)).toBe(false);
  });

  it('rechaza cadenas malformadas sin lanzar excepción', () => {
    expect(validateCheckoutNonce('', 'tienda-a', NOW)).toBe(false);
    expect(validateCheckoutNonce('basura', 'tienda-a', NOW)).toBe(false);
    expect(validateCheckoutNonce(`${NOW}.no-es-hex`, 'tienda-a', NOW)).toBe(false);
    expect(validateCheckoutNonce(`${NOW}.${'z'.repeat(64)}`, 'tienda-a', NOW)).toBe(false);
  });

  it('es determinista dentro de la ventana: ISR sirve el mismo nonce a todos los renders', () => {
    const earlyInWindow = checkoutWindowStart(NOW) + 1000;
    const lateInWindow = checkoutWindowStart(NOW) + WINDOW_MS - 1000;
    expect(issueCheckoutNonce('tienda-a', earlyInWindow)).toBe(issueCheckoutNonce('tienda-a', lateInWindow));
  });
});

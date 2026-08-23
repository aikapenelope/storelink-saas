import { beforeEach, describe, expect, it, vi } from 'vitest';
import { issueCheckoutNonce } from '../../src/lib/checkout-nonce';
import {
  clientIpFromHeaders,
  evaluateCheckoutGuards,
  evaluateHoneypot,
} from '../../src/lib/checkout-guard';
import { checkCheckoutRateLimit } from '../../src/lib/rate-limit';

process.env.CHECKOUT_NONCE_SECRET ||= 'test-secret-anti-abuso-0123456789abcdef';

vi.mock('../../src/lib/rate-limit', () => ({
  checkCheckoutRateLimit: vi.fn(),
}));

const mockRateLimit = vi.mocked(checkCheckoutRateLimit);
const NOW = 1_750_000_000_000;

beforeEach(() => {
  mockRateLimit.mockReset().mockResolvedValue({ allowed: true });
});

function legitInput(overrides: Partial<Parameters<typeof evaluateCheckoutGuards>[0]> = {}) {
  return {
    tenantSlug: 'tienda-a',
    nonce: issueCheckoutNonce('tienda-a', NOW),
    honeypotWebsite: '',
    formRenderedAtMs: NOW - 10_000,
    clientIp: '1.2.3.4',
    now: NOW,
    ...overrides,
  };
}

describe('evaluateHoneypot', () => {
  it('acepta un humano típico (campo vacío, formulario abierto hace >3s)', () => {
    expect(evaluateHoneypot({ honeypotWebsite: '', formRenderedAtMs: NOW - 60_000 }, NOW)).toBe(true);
  });

  it('rechaza si el campo trampa llega lleno', () => {
    expect(evaluateHoneypot({ honeypotWebsite: 'http://spam.example', formRenderedAtMs: NOW - 60_000 }, NOW)).toBe(false);
  });

  it('rechaza envíos en menos de 3 segundos desde el render', () => {
    expect(evaluateHoneypot({ honeypotWebsite: '', formRenderedAtMs: NOW - 1_000 }, NOW)).toBe(false);
  });

  it('rechaza timestamps ausentes, cero, negativos o del futuro (más allá del skew tolerado)', () => {
    expect(evaluateHoneypot({ honeypotWebsite: '' }, NOW)).toBe(false);
    expect(evaluateHoneypot({ honeypotWebsite: '', formRenderedAtMs: Number.NaN }, NOW)).toBe(false);
    expect(evaluateHoneypot({ honeypotWebsite: '', formRenderedAtMs: 0 }, NOW)).toBe(false);
    expect(evaluateHoneypot({ honeypotWebsite: '', formRenderedAtMs: -5_000 }, NOW)).toBe(false);
    expect(evaluateHoneypot({ honeypotWebsite: '', formRenderedAtMs: NOW + 60_000 }, NOW)).toBe(false);
  });
});

describe('evaluateCheckoutGuards', () => {
  it('un pedido legítimo pasa todas las trampas', async () => {
    const result = await evaluateCheckoutGuards(legitInput());
    expect(result).toEqual({ ok: true });
    expect(mockRateLimit).toHaveBeenCalledWith('1.2.3.4:tienda-a');
  });

  it('nonce inválido → error genérico y NI SIQUIERA consulta el rate-limit', async () => {
    const result = await evaluateCheckoutGuards(legitInput({ nonce: 'firmado-a-mano' }));
    expect(result).toEqual({
      ok: false,
      error: 'No se pudo validar el pedido. Recarga la página e inténtalo de nuevo.',
    });
    expect(mockRateLimit).not.toHaveBeenCalled();
  });

  it('honeypot lleno → mismo error genérico (sin revelar la trampa)', async () => {
    const result = await evaluateCheckoutGuards(legitInput({ honeypotWebsite: 'spam' }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No se pudo validar');
    expect(mockRateLimit).not.toHaveBeenCalled();
  });

  it('rate-limit excedido → mensaje de espera', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const result = await evaluateCheckoutGuards(legitInput());
    expect(result).toEqual({
      ok: false,
      error: 'Demasiados intentos. Espera un momento y vuelve a intentarlo.',
    });
  });

  it('identificador del rate-limit = ip:tenantSlug', async () => {
    await evaluateCheckoutGuards(
      legitInput({ clientIp: '200.1.2.3', tenantSlug: 'aurita', nonce: issueCheckoutNonce('aurita', NOW) })
    );
    expect(mockRateLimit).toHaveBeenCalledWith('200.1.2.3:aurita');
  });
});

describe('clientIpFromHeaders', () => {
  it('toma el PRIMER valor de x-forwarded-for (patrón Vercel)', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
    expect(clientIpFromHeaders(headers)).toBe('203.0.113.5');
  });

  it('cae a x-real-ip y luego a unknown sin cabeceras de proxy', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
    expect(clientIpFromHeaders(new Headers())).toBe('unknown');
  });
});

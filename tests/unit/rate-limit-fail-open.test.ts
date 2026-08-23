import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * El wrapper de Upstash debe ser fail-open en ambos modos de fallo (decisión
 * del Sprint 5): sin env vars configuradas o con Redis inalcanzable, el
 * checkout sigue y solo se registra warning. vi.resetModules() renueva el
 * singleton del limiter entre casos.
 */

const ENV_KEYS = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'RATE_LIMIT_CHECKOUT_PER_MIN'] as const;
const envBackup = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (envBackup[key] === undefined) delete process.env[key];
    else process.env[key] = envBackup[key];
  }
  vi.resetModules();
});

describe('checkCheckoutRateLimit — fail-open', () => {
  it('permite el checkout si faltan las env vars de Upstash', async () => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const mod = await import('../../src/lib/rate-limit');
    const verdict = await mod.checkCheckoutRateLimit('1.2.3.4:tienda-a');
    expect(verdict.allowed).toBe(true);
  });

  it('permite el checkout si Redis es inalcanzable (red caída)', async () => {
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'https://127.0.0.1:9';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    const mod = await import('../../src/lib/rate-limit');
    const verdict = await mod.checkCheckoutRateLimit('1.2.3.4:tienda-a');
    expect(verdict.allowed).toBe(true);
  });

  it('usa 5/min como default cuando RATE_LIMIT_CHECKOUT_PER_MIN no es válido', async () => {
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'https://127.0.0.1:9';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.RATE_LIMIT_CHECKOUT_PER_MIN = 'no-es-un-numero';

    // La prueba observable del default es indirecta (no hay red real): aquí
    // solo verificamos que la construcción no lanza y el veredicto es fail-open.
    const mod = await import('../../src/lib/rate-limit');
    const verdict = await mod.checkCheckoutRateLimit('1.2.3.4:tienda-a');
    expect(verdict.allowed).toBe(true);
  });
});

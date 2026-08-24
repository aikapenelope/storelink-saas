import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ROUTE_LIMITS, parseRateLimitMax } from '../../src/lib/rate-limit';

/**
 * El limiter de rutas admin (R8, plan v2) hereda las mismas garantías que el
 * del checkout: fail-open sin env vars o con Redis inalcanzable. El contador
 * real lo ejercita el preview; aquí se verifica el contrato de tolerancia.
 * vi.resetModules() renueva el singleton entre casos (patrón del test de
 * rate-limit-fail-open).
 */

const ENV_KEYS = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'] as const;
const envBackup = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (envBackup[key] === undefined) delete process.env[key];
    else process.env[key] = envBackup[key];
  }
  vi.resetModules();
});

describe('ADMIN_ROUTE_LIMITS', () => {
  it('cotas por ruta según plan v2 R8', () => {
    expect(ADMIN_ROUTE_LIMITS['import-csv']).toBe(2);
    expect(ADMIN_ROUTE_LIMITS['sync-sheets']).toBe(4);
    expect(ADMIN_ROUTE_LIMITS['order-status']).toBe(30);
    expect(ADMIN_ROUTE_LIMITS['order-pdf']).toBe(30);
  });
});

describe('checkAdminRouteRateLimit — fail-open', () => {
  it('permite la operación si faltan las env vars de Upstash', async () => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const mod = await import('../../src/lib/rate-limit');
    const verdict = await mod.checkAdminRouteRateLimit('import-csv', 42);
    expect(verdict.allowed).toBe(true);
  });

  it('permite la operación si Redis es inalcanzable (red caída)', async () => {
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'https://127.0.0.1:9';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    const mod = await import('../../src/lib/rate-limit');
    const verdict = await mod.checkAdminRouteRateLimit('sync-sheets', 42);
    expect(verdict.allowed).toBe(true);
  });
});

describe('parseRateLimitMax (checkout, sin cambios)', () => {
  it('mantiene su contrato original', () => {
    expect(parseRateLimitMax(undefined)).toBe(5);
    expect(parseRateLimitMax('12')).toBe(12);
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * PR 5 (SPEC-20260907-5, auditoría C1/3E-P2-1): regresión del catch del
 * storefront. Antes, un fallo de BD se convertía en notFound() → ISR cachea
 * un 404 de una tienda viva durante 5 minutos.
 *
 * El page es un Server Component async; se mockean sus dependencias directas
 * (payload, storefront-cache, tenants, exchange-rate, next/cache) para
 * aislar EXCLUSIVAMENTE la semántica 404-vs-500 del catch. RSC internals de
 * Next (getPayload → config) no se tocan: se mockea el módulo completo.
 */

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ db: {} })),
}));

vi.mock('@payload-config', () => ({ default: {} }));

vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock('@/lib/tenants', () => ({
  getTenantBySlug: vi.fn(),
}));

vi.mock('@/lib/storefront-cache', () => ({
  getCachedProducts: vi.fn(async () => ({ products: [] })),
}));

vi.mock('@/lib/exchange-rate', () => ({
  resolveExchangeRateVES: vi.fn(async () => ({ rate: 40, source: 'manual' })),
}));

vi.mock('@/components/storefront-client', () => ({
  StorefrontClient: () => null,
}));

import { getTenantBySlug } from '@/lib/tenants';

const mockGetTenantBySlug = vi.mocked(getTenantBySlug);

// Import perezoso: la importación top-level del page registraría "use client"
// boundaries de React 19 al evaluar storefront-client (mockeado igualmente).
const loadPage = async () => {
  vi.resetModules();
  const mod = await import('../../src/app/(app)/[tenant]/page');
  return mod.default;
};

const renderStorefront = async (slug: string) =>
  (await loadPage())({ params: Promise.resolve({ tenant: slug }) });

describe('storefront [tenant]/page — 404 solo si el tenant no existe (PR 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (!process.env.PAYLOAD_SECRET) process.env.PAYLOAD_SECRET = 'test-secret';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('tenant inexistente → notFound (digest NEXT_HTTP_ERROR_FALLBACK;404), no 500', async () => {
    mockGetTenantBySlug.mockResolvedValueOnce(null);

    // notFound() lanza un Error con digest del framework — es la señal
    // oficial de 404 que Next convierte en not-found boundary + noindex.
    await expect(renderStorefront('tienda-inexistente')).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });
    expect(mockGetTenantBySlug).toHaveBeenCalledWith('tienda-inexistente');
  });

  it('fallo de BD al consultar el tenant → propaga el error (500), JAMÁS notFound', async () => {
    const infraError = new Error('connection terminated unexpectedly');
    mockGetTenantBySlug.mockRejectedValueOnce(infraError);

    // AC del roadmap: fallo BD simulado → 500 (el error atraviesa el catch
    // sin degradarse a 404, que ISR cachearía 5 min).
    await expect(renderStorefront('tienda-viva')).rejects.toBe(infraError);
    // Sanity: el digest del error de infra NO es el de notFound.
    expect((infraError as { digest?: string }).digest).toBeUndefined();
  });

  it('fallo de infra DESPUÉS del lookup (productos) → propaga (500), no 404', async () => {
    const { getCachedProducts } = await import('@/lib/storefront-cache');
    mockGetTenantBySlug.mockResolvedValueOnce({
      id: 7,
      name: 'Tienda Viva',
      slug: 'tienda-viva',
      branding: {},
    } as never);
    vi.mocked(getCachedProducts).mockRejectedValueOnce(
      new Error('Redis connection lost') as never
    );

    // El fallo ocurre tras confirmar que la tienda existe: un 404 aquí
    // mintió al cliente sobre la existencia de la tienda.
    await expect(renderStorefront('tienda-viva')).rejects.toThrow('Redis connection lost');
  });

  it('tenant vivo con catálogo OK → renderiza sin lanzar', async () => {
    mockGetTenantBySlug.mockResolvedValueOnce({
      id: 7,
      name: 'Tienda Viva',
      slug: 'tienda-viva',
      branding: {},
    } as never);

    const result = await renderStorefront('tienda-viva');
    expect(result).toBeDefined();
  });
});

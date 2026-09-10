import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import config from '../payload.config';

/**
 * PR 3.4 (plan sprints 2026-09-09): el fixture de zonas del seed e2e.
 * La spec Playwright (storefront-zones.e2e.spec.ts) requiere `pnpm dev`
 * contra una BD con migraciones al día (contrato documentado en
 * playwright.config.ts — en preview/CI-merge del PR 3.2 la BD reproducible
 * existe). Este test int valida la PARTE que este PR introduce: el action
 * `seed` del endpoint acepta `zones` opcionales y persiste
 * deliveryConfig.zones en el tenant creado (el hueco del TDZ #101 era que
 * NINGÚN fixture sembraba zonas).
 */

vi.stubEnv('E2E_SEED_SECRET', 'test-e2e-seed');
vi.stubEnv('NODE_ENV', 'test');

const runIntegration = !!process.env.TEST_DATABASE_URI;
const d = runIntegration ? describe : describe.skip;

let payload: Payload;
let tenantId: number | undefined;
let tenantSlug: string | undefined;

beforeAll(async () => {
  payload = await getPayload({ config: config as never });
}, 120000);

afterAll(async () => {
  if (tenantId !== undefined) {
    await payload.delete({ collection: 'tenants', id: tenantId, overrideAccess: true }).catch(() => null);
  }
  await payload.destroy();
});

d('seed e2e con deliveryConfig.zones (PR 3.4, hueco del TDZ #101)', () => {
  it('action seed con zones persiste las zonas en el tenant', async () => {
    const { POST } = await import('../../src/app/api/e2e/seed/route');
    const response = await POST(
      new Request('http://localhost/api/e2e/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-e2e-secret': 'test-e2e-seed',
        },
        body: JSON.stringify({
          action: 'seed',
          email: 'e2e-zones@storelink.test',
          password: 'e2e-test-password',
          tenantSlug: `e2e-zones-${Date.now()}`,
          productSku: 'E2E-ZONES',
          zones: [
            { name: 'Zona E2E Norte', priceDelivery: 3 },
            { name: 'Zona E2E Sur', priceDelivery: 4.5 },
          ],
        }),
      }) as unknown as Parameters<typeof POST>[0]
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { tenantId: number; tenantSlug: string };
    tenantId = body.tenantId;
    tenantSlug = body.tenantSlug;
    expect(tenantId).toBeDefined();

    // El tenant persistió las zonas — el fixture que el TDZ #101 necesitaba.
    const tenant = (await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      overrideAccess: true,
    })) as unknown as {
      deliveryConfig?: { zones?: Array<{ name?: string; priceDelivery?: number }> };
    };
    expect(tenant.deliveryConfig?.zones).toHaveLength(2);
    expect(tenant.deliveryConfig?.zones?.[0]?.name).toBe('Zona E2E Norte');
    expect(tenant.deliveryConfig?.zones?.[0]?.priceDelivery).toBe(3);
  }, 60000);

  it('sin zones el tenant se crea como antes (backwards-compatible)', async () => {
    const { POST } = await import('../../src/app/api/e2e/seed/route');
    const response = await POST(
      new Request('http://localhost/api/e2e/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-e2e-secret': 'test-e2e-seed',
        },
        body: JSON.stringify({
          action: 'seed',
          email: 'e2e-nozones@storelink.test',
          password: 'e2e-test-password',
          tenantSlug: `e2e-nozones-${Date.now()}`,
          productSku: 'E2E-NOZONES',
        }),
      }) as unknown as Parameters<typeof POST>[0]
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { tenantId: number };
    await payload.delete({ collection: 'tenants', id: body.tenantId, overrideAccess: true }).catch(
      () => null
    );
  }, 60000);

  it('zones malformadas se sanitizan (sin name → descartadas)', async () => {
    const { POST } = await import('../../src/app/api/e2e/seed/route');
    const response = await POST(
      new Request('http://localhost/api/e2e/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-e2e-secret': 'test-e2e-seed',
        },
        body: JSON.stringify({
          action: 'seed',
          email: 'e2e-badzones@storelink.test',
          password: 'e2e-test-password',
          tenantSlug: `e2e-badzones-${Date.now()}`,
          productSku: 'E2E-BADZONES',
          zones: [{ priceDelivery: 5 }, { name: 'Válida', priceDelivery: 1 }],
        }),
      }) as unknown as Parameters<typeof POST>[0]
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { tenantId: number };
    const tenant = (await payload.findByID({
      collection: 'tenants',
      id: body.tenantId,
      overrideAccess: true,
    })) as unknown as {
      deliveryConfig?: { zones?: Array<{ name?: string }> };
    };
    // Solo la zona válida persiste (sanitización del endpoint).
    expect(tenant.deliveryConfig?.zones).toHaveLength(1);
    expect(tenant.deliveryConfig?.zones?.[0]?.name).toBe('Válida');
    await payload.delete({ collection: 'tenants', id: body.tenantId, overrideAccess: true }).catch(
      () => null
    );
    void tenantSlug;
  }, 60000);

  it('zone con priceDelivery negativo se sanitiza a 0 (fix Devin #115)', async () => {
    // Regresión: antes del fix, -5 pasaba el typeof check y Payload lo
    // rechazaba con min: 0 → 500 → seed abortaba sin crear ningún fixture.
    const { POST } = await import('../../src/app/api/e2e/seed/route');
    const response = await POST(
      new Request('http://localhost/api/e2e/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-e2e-secret': 'test-e2e-seed',
        },
        body: JSON.stringify({
          action: 'seed',
          email: 'e2e-negprice@storelink.test',
          password: 'e2e-test-password',
          tenantSlug: `e2e-negprice-${Date.now()}`,
          productSku: 'E2E-NEGPRICE',
          zones: [{ name: 'Zona Negativa', priceDelivery: -5 }],
        }),
      }) as unknown as Parameters<typeof POST>[0]
    );

    // El seed completa exitosamente — no aborta con 500.
    expect(response.status).toBe(200);
    const body = (await response.json()) as { tenantId: number };
    const tenant = (await payload.findByID({
      collection: 'tenants',
      id: body.tenantId,
      overrideAccess: true,
    })) as unknown as {
      deliveryConfig?: { zones?: Array<{ name?: string; priceDelivery?: number }> };
    };
    // El priceDelivery negativo se sanitizó a 0.
    expect(tenant.deliveryConfig?.zones).toHaveLength(1);
    expect(tenant.deliveryConfig?.zones?.[0]?.name).toBe('Zona Negativa');
    expect(tenant.deliveryConfig?.zones?.[0]?.priceDelivery).toBe(0);
    await payload.delete({ collection: 'tenants', id: body.tenantId, overrideAccess: true }).catch(
      () => null
    );
  }, 60000);
});

void vi;

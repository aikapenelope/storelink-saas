import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import config from '../payload.config';

// Sin mocks de red: este test solo ejercita el hook beforeChange de
// Products (conteo + límite del plan) contra la BD de test.

const runIntegration = !!process.env.TEST_DATABASE_URI;
const d = runIntegration ? describe : describe.skip;

let payload: Payload;
let tenantId: number;
const createdProductIds: number[] = [];

const uniqueSuffix = Date.now();

beforeAll(async () => {
  payload = await getPayload({ config: config as never });

  // Tenant en plan básico (límite 500): se crean 2 productos vía el canal
  // del import (skipCatalogLimitGate) y se prueba que el canal MANUAL sin
  // el escape funciona normal por debajo del cupo. La frontera exacta
  // (count == limit → 403) se valida en tests/unit/catalog-limit-gate.test.ts
  // con el conteo mockeado: sembrar 500 filas en integración sería lento y
  // frágil.
  const tenant = await payload.create({
    collection: 'tenants',
    overrideAccess: true,
    data: {
      name: 'Tienda Cupo Test',
      slug: `test-cupo-${uniqueSuffix}`,
      whatsappPhone: '+584120000000',
      plan: 'basico',
    } as never,
  });
  tenantId = tenant.id as number;
}, 120000);

afterAll(async () => {
  for (const id of createdProductIds) {
    await payload.delete({ collection: 'products', id, overrideAccess: true }).catch(() => null);
  }
  await payload.destroy();
});

d('hook enforceCatalogLimitOnCreate (puerta de cupo en create manual)', () => {
  it('create manual por debajo del cupo pasa (sin interferencia del gate)', async () => {
    const okProduct = await payload.create({
      collection: 'products',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        title: 'Producto Bajo Cupo',
        price: 1,
        sku: `CUPO-OK-${uniqueSuffix}`,
      } as never,
    });
    createdProductIds.push(okProduct.id as number);
    expect(okProduct.id).toBeDefined();
  }, 60000);

  it('update de un producto existente NO dispara el gate (no consume cupo)', async () => {
    const updated = await payload.update({
      collection: 'products',
      id: createdProductIds[0],
      overrideAccess: true,
      data: { price: 2 },
    });
    expect(Number(updated.price)).toBe(2);
  }, 60000);

  it('el canal del import (context.skipCatalogLimitGate) no pasa por el gate', async () => {
    const product = await payload.create({
      collection: 'products',
      overrideAccess: true,
      context: { skipCatalogLimitGate: true },
      data: {
        tenant: tenantId,
        title: 'Producto Via Import',
        price: 1,
        sku: `CUPO-SKIP-${uniqueSuffix}`,
      } as never,
    });
    createdProductIds.push(product.id as number);
    expect(product.id).toBeDefined();
  }, 60000);
});

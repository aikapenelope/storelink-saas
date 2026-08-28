import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import config from '../payload.config';
import type { Product } from '@/payload-types';

/**
 * Cubre el job `catalogImportRows` (src/jobs/catalog-import.ts): el import de
 * catálogo (CSV/Sheets) movido a la Jobs Queue oficial, mismo dual-dispatch
 * que order-created.ts. Sin este test, la lógica de upsert por SKU y creación
 * de categorías del job nunca se ejercitaba (solo aparecía referenciada en
 * migration-parity.test.ts para chequear que la config no rompiera).
 */
const runIntegration = !!process.env.TEST_DATABASE_URI;
const d = runIntegration ? describe : describe.skip;

let payload: Payload;
let tenantId: number;
let tenantSlug: string;

beforeAll(async () => {
  payload = await getPayload({ config: config as never });

  const tenant = await payload.create({
    collection: 'tenants',
    overrideAccess: true,
    data: {
      name: 'Tienda Catalog Import Test',
      slug: `catalog-import-test-${Date.now()}`,
      whatsappPhone: '+584120000000',
    } as never,
  });
  tenantId = tenant.id as number;
  tenantSlug = tenant.slug as string;
}, 120000);

afterAll(async () => {
  await payload
    .delete({
      collection: 'products',
      where: { tenant: { equals: tenantId } },
      overrideAccess: true,
    })
    .catch(() => null);
  await payload
    .delete({
      collection: 'categories',
      where: { tenant: { equals: tenantId } },
      overrideAccess: true,
    })
    .catch(() => null);
  await payload.delete({ collection: 'tenants', id: tenantId, overrideAccess: true }).catch(() => null);
  await payload.destroy();
});

d('job catalogImportRows (Jobs Queue oficial)', () => {
  it('crea productos nuevos y su categoría a partir del CSV encolado', async () => {
    const csvText = [
      'title,price,sku,category,stock',
      'Producto Uno,10.5,CAT-IMP-1,Bebidas,20',
      'Producto Dos,7.25,CAT-IMP-2,Bebidas,5',
    ].join('\n');

    const job = await payload.jobs.queue({
      task: 'catalogImportRows',
      input: { tenantId, tenantSlug, csvText },
    });
    const runResult = await payload.jobs.runByID({ id: job.id });
    expect(runResult.jobStatus?.[job.id]?.status).not.toBe('error');

    const products = await payload.find({
      collection: 'products',
      where: { tenant: { equals: tenantId } },
      overrideAccess: true,
      depth: 0,
    });
    expect(products.docs).toHaveLength(2);

    const bySku = new Map((products.docs as Product[]).map((p) => [p.sku, p]));
    expect(bySku.get('CAT-IMP-1')?.title).toBe('Producto Uno');
    expect(Number(bySku.get('CAT-IMP-1')?.price)).toBe(10.5);
    expect(bySku.get('CAT-IMP-2')?.title).toBe('Producto Dos');

    const categories = await payload.find({
      collection: 'categories',
      where: { tenant: { equals: tenantId } },
      overrideAccess: true,
    });
    expect(categories.docs).toHaveLength(1);
    expect(categories.docs[0].slug).toBe('bebidas');
  }, 60000);

  it('reimportar el mismo SKU actualiza en vez de duplicar (upsert idempotente)', async () => {
    const csvText = ['title,price,sku,category,stock', 'Producto Uno Actualizado,12.99,CAT-IMP-1,Bebidas,15'].join(
      '\n'
    );

    const job = await payload.jobs.queue({
      task: 'catalogImportRows',
      input: { tenantId, tenantSlug, csvText },
    });
    await payload.jobs.runByID({ id: job.id });

    const products = await payload.find({
      collection: 'products',
      where: { tenant: { equals: tenantId } },
      overrideAccess: true,
      depth: 0,
    });
    // Sigue habiendo 2 productos (CAT-IMP-1 actualizado, CAT-IMP-2 intacto) — no se duplicó.
    expect(products.docs).toHaveLength(2);

    const updated = (products.docs as Product[]).find((p) => p.sku === 'CAT-IMP-1');
    expect(updated?.title).toBe('Producto Uno Actualizado');
    expect(Number(updated?.price)).toBe(12.99);
    expect(updated?.stockQuantity).toBe(15);
  }, 60000);
});

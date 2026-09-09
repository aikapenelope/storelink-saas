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

  /**
   * Review Devin #96 hallazgos 3+4 (regresión): el output del import vive en
   * payload_jobs_log (fila del task con state='succeeded') — NO en un campo
   * `output` del job — y debe incluir rejectedImageUrls (URLs descartadas por
   * la whitelist de hosts, cuenta de URLs no de filas). Es exactamente lo
   * que /api/[tenant]/import-status lee para el reporte del admin.
   */
  it('el output del job persiste en payload_jobs_log con rejectedImageUrls (Devin #96)', async () => {
    const csvText = [
      'title,price,sku,image',
      // 1 URL válida (R2/martes.app) + 2 URLs con host no permitido → el
      // output debe reportar rejectedImageUrls=2 y el producto sin imágenes.
      'Con Fotos,9.99,IMP-IMG-OK,https://imagenes.martes.app/foto.jpg;https://host-raro.example/a.png;https://otro-raro.example/b.png',
    ].join('\n');

    const job = await payload.jobs.queue({
      task: 'catalogImportRows',
      input: { tenantId, tenantSlug, csvText },
    });
    await payload.jobs.runByID({ id: job.id });

    // El job completó (deleteJobOnComplete:false → persiste con completedAt).
    const doneRes = await payload.db.drizzle.execute(
      (await import('@payloadcms/db-postgres/drizzle')).sql`SELECT completed_at FROM payload_jobs WHERE id = ${job.id}`
    );
    expect(doneRes.rows[0]?.completed_at).toBeTruthy();

    // El output vive en la tabla HIJA (payload_jobs_log) — mismo sitio que
    // lee /api/[tenant]/import-status tras el hallazgo 3 de Devin.
    const logRes = await payload.db.drizzle.execute(
      (await import('@payloadcms/db-postgres/drizzle')).sql`
        select l.output as output, l.state as state
        from payload_jobs_log l
        where l._parent_id = ${job.id}
          and l.task_slug = 'catalogImportRows'
          and l.state = 'succeeded'
        order by l._order desc
        limit 1
      `
    );
    const row = logRes.rows[0] as { output?: Record<string, unknown>; state?: string } | undefined;
    expect(row?.state).toBe('succeeded');

    const output = (row?.output ?? {}) as {
      created?: number;
      updated?: number;
      errorCount?: number;
      rejectedImageUrls?: number;
    };
    expect(Number(output.created)).toBe(1);
    // Hallazgo 4: las 2 URLs de host no permitido quedaron CONTADAS (no
    // silenciosas) — el admin las verá en el reporte del import.
    expect(Number(output.rejectedImageUrls)).toBe(2);
    expect(Number(output.errorCount)).toBe(0);

    // Y el producto nació solo con la URL permitida.
    const prod = (await payload.find({
      collection: 'products',
      where: { tenant: { equals: tenantId }, sku: { equals: 'IMP-IMG-OK' } },
      overrideAccess: true,
      depth: 0,
    })) as unknown as { docs: Array<{ imageUrls?: string[] }> };
    expect(prod.docs[0]?.imageUrls).toEqual(['https://imagenes.martes.app/foto.jpg']);
  }, 60000);
});

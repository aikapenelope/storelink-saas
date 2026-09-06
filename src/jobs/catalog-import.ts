import type { TaskConfig } from 'payload';
import { revalidatePath } from 'next/cache';
import { Redis } from '@upstash/redis';
import { sanitizeCsvCell, parseCSVLine } from '@/lib/csv';
import { isAllowedImageUrl, normalizeProductImageUrl } from '@/lib/image-hosts';
import { invalidateProductsCache } from '@/lib/storefront-cache';
import { getCatalogLimit } from '@/lib/tenant-plans';
import type { Category, Product } from '@/payload-types';

/**
 * Lock de importación POR TENANT (review Devin #84): el conteo del cupo es un
 * snapshot al inicio del job — dos jobs concurrentes para el mismo tenant
 * (CSV + Sheets, doble clic, corrida + retry) consumirían el MISMO cupo y
 * superarían el plan. El lock (SET NX EX, mismo patrón que la idempotencia
 * del checkout) serializa las importaciones de un tenant: con él, el
 * snapshot es exacto durante toda la corrida. FAIL-OPEN decidido con el
 * dueño (lib/rate-limit): si Upstash no responde, se importa sin lock.
 *
 * Si el lock está tomado, el job FALLA y la cola lo reintenta (retries 3 ×
 * 30s + runner externo) con snapshot fresco — el procesamiento es idempotente
 * (upsert por SKU), así que reintentos nunca duplican filas.
 */
const IMPORT_LOCK_TTL_SECONDS = 900; // 15 min: acota locks huérfanos si una función muere a mitad

let importLockRedis: Redis | null | undefined;

function getImportLockRedis(): Redis | null {
  if (importLockRedis !== undefined) return importLockRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    importLockRedis = null;
    return null;
  }
  importLockRedis = new Redis({ url, token });
  return importLockRedis;
}

function importLockKey(tenantId: number | string): string {
  return `storelink:import-lock:${tenantId}`;
}

async function acquireTenantImportLock(tenantId: number | string): Promise<boolean> {
  const redis = getImportLockRedis();
  if (!redis) return true; // fail-open
  try {
    const res = await redis.set(importLockKey(tenantId), 'locked', {
      nx: true,
      ex: IMPORT_LOCK_TTL_SECONDS,
    });
    return res === 'OK';
  } catch (err) {
    console.warn('Lock de importación no disponible (fail-open):', err);
    return true;
  }
}

async function releaseTenantImportLock(tenantId: number | string): Promise<void> {
  const redis = getImportLockRedis();
  if (!redis) return;
  try {
    await redis.del(importLockKey(tenantId));
  } catch {
    // Non-blocking: el TTL acota la vida del lock si el DEL falla.
  }
}

/**
 * Jobs Queue oficial de Payload 3 (mismo patrón que src/jobs/order-created.ts):
 * import de catálogo (CSV o Google Sheets, ambos llegan aquí como texto CSV
 * plano) movido FUERA del request síncrono de Vercel. Antes,
 * import-csv/route.ts y sync-sheets/route.ts procesaban hasta 5.000 filas
 * dentro del propio request — riesgo real de timeout de función serverless
 * en catálogos grandes (hallazgo de la auditoría profunda de 2026-08-29, §1).
 * No se suma infraestructura nueva (Inngest/QStash/Vercel Queues): se
 * reutiliza la Jobs Queue y el runner externo (.github/workflows/jobs-
 * runner.yml, cada 5 min) que YA existen para order-created.
 *
 * Dual-dispatch idéntico al de checkout.ts: la ruta encola la tarea y la
 * ejecuta al instante vía payload.jobs.runByID() dentro de after() (caso
 * feliz, catálogos chicos/medianos); si la función se corta a mitad de un
 * catálogo grande, el runner externo retoma el job en <5 min sin duplicar
 * filas ya procesadas (la tarea es idempotente: upsert por SKU, igual que
 * hoy).
 */
const catalogImportRows: TaskConfig = {
  slug: 'catalogImportRows',
  label: 'Importar filas de catálogo (CSV/Sheets) en background',
  retries: { attempts: 3, backoff: { type: 'fixed', delay: 30000 } },
  inputSchema: [
    { name: 'tenantId', type: 'number', required: true },
    { name: 'tenantSlug', type: 'text', required: true },
    { name: 'csvText', type: 'textarea', required: true },
  ],
  outputSchema: [
    { name: 'created', type: 'number' },
    { name: 'updated', type: 'number' },
    { name: 'errorCount', type: 'number' },
    { name: 'limitReached', type: 'checkbox' },
  ],
  handler: async ({ input, req }) => {
    const { payload } = req;
    const { tenantId, tenantSlug, csvText } = input as {
      tenantId: number;
      tenantSlug: string;
      csvText: string;
    };

    // Review Devin #84: serializa importaciones concurrentes del MISMO tenant
    // (el conteo de cupo es un snapshot — ver helper del lock arriba). Si el
    // lock está tomado, fallar el job hace que la cola lo reintente.
    const lockAcquired = await acquireTenantImportLock(tenantId);
    if (!lockAcquired) {
      throw new Error(
        `Otra importación está en curso para el tenant ${tenantId}; el job se reintentará con snapshot fresco`
      );
    }

    try {
      // La autorización ya se resolvió ANTES de encolar (la ruta valida
      // sesión + pertenencia del tenant); aquí el job corre con
      // overrideAccess:true igual que order-created.ts, siempre acotado a
      // este tenantId explícito.
      const rawLines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const csvHeaders = parseCSVLine(rawLines[0] || '').map((h) => h.toLowerCase().trim());
      const skuIdx = csvHeaders.findIndex((h) => h === 'sku' || h === 'codigo');
      const titleIdx = csvHeaders.findIndex((h) => h === 'title' || h === 'nombre' || h === 'producto');
      const priceIdx = csvHeaders.findIndex((h) => h === 'price' || h === 'precio');
      const catIdx = csvHeaders.findIndex((h) => h === 'category' || h === 'categoria' || h === 'rubro');
      const descIdx = csvHeaders.findIndex((h) => h === 'description' || h === 'descripcion');
      const stockIdx = csvHeaders.findIndex((h) => h === 'stock' || h === 'cantidad' || h === 'stock_quantity');
      const imgIdx = csvHeaders.findIndex(
        (h) => h === 'image' || h === 'images' || h === 'image_url' || h === 'imagen' || h === 'foto' || h === 'url_imagen' || h === 'img'
      );

      let createdCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      let limitReached = false;

      // Puerta de cuota por plan (auditoría 2026-09-05, P1-1): el límite es
      // sobre el TOTAL de productos del tenant. Los UPDATES de SKUs existentes
      // nunca consumen cupo (un re-sync del catálogo completo sigue válido);
      // solo las CREACIONES nuevas se detienen al agotarlo. El doc del tenant
      // se lee aquí (no viaja en el input) para no cambiar inputSchema de jobs
      // ya en cola.
      let catalogLimit = getCatalogLimit(null);
      try {
        const tenantDoc = await payload.findByID({
          collection: 'tenants',
          id: tenantId,
          depth: 0,
          overrideAccess: true,
        });
        catalogLimit = getCatalogLimit(tenantDoc.plan);
      } catch {
        console.warn(
          `[storelink][catalog-import] tenant ${tenantId} no legible; usando límite estándar`
        );
      }

      const existingProductsRes = await payload.find({
        collection: 'products',
        where: { tenant: { equals: tenantId } },
        limit: 5000,
        depth: 0,
        overrideAccess: true,
      });
      // totalDocs refleja el conteo REAL aunque los docs se trunquen en 5000.
      const allowedNewCreations = Math.max(
        0,
        catalogLimit - existingProductsRes.totalDocs
      );
      const productBySku = new Map<string, Product>();
      for (const prod of existingProductsRes.docs as Product[]) {
        if (prod.sku) productBySku.set(prod.sku, prod);
      }

      const existingCatsRes = await payload.find({
        collection: 'categories',
        where: { tenant: { equals: tenantId } },
        limit: 500,
        depth: 0,
        overrideAccess: true,
      });
      const categoryCache = new Map<string, number>();
      for (const cat of existingCatsRes.docs as Category[]) {
        if (cat.slug) categoryCache.set(cat.slug, cat.id);
      }

      for (let i = 1; i < rawLines.length; i++) {
        const cols = parseCSVLine(rawLines[i]);
        const title = sanitizeCsvCell(cols[titleIdx]);
        const price = parseFloat(cols[priceIdx]) || 0;
        const sku = skuIdx !== -1 && cols[skuIdx] ? sanitizeCsvCell(cols[skuIdx]) : `SKU-${Date.now()}-${i}`;
        const description = descIdx !== -1 ? sanitizeCsvCell(cols[descIdx]) : '';
        const stockQuantity = stockIdx !== -1 ? parseInt(cols[stockIdx], 10) || 0 : undefined;
        const rawCategory = catIdx !== -1 && cols[catIdx] ? sanitizeCsvCell(cols[catIdx]) : '';
        // Auditoría final 2026-09-01 (CRÍTICO): descartar URLs con host fuera de
        // la whitelist (src/lib/image-hosts.ts). Un host no listado hacía que
        // next/image lanzara en render y tumbara el storefront entero del tenant.
        const imageUrls =
          imgIdx !== -1 && cols[imgIdx]
            ? cols[imgIdx]
                .split(/[,;\n\r]+/)
                .map((u) => normalizeProductImageUrl(sanitizeCsvCell(u).trim()))
                .filter((u) => Boolean(u) && isAllowedImageUrl(u))
                .slice(0, 6)
            : [];

        if (!title) continue;

        // Auditoría 2026-09-04 (P3): `parseFloat || 0` convertía celdas vacías o
        // basura en precio 0 → producto "gratis" en el catálogo (el checkout solo
        // rechaza si TODA la orden es 0). Una fila sin precio válido es un error
        // de datos: se cuenta como error y no se importa.
        if (!(price > 0)) {
          console.warn(`[storelink][catalog-import] fila ${i + 1} inválida: precio "${cols[priceIdx]}"`);
          errorCount++;
          continue;
        }

        // Review Devin #84: la decisión de cupo va ANTES de resolver/crear la
        // categoría — una fila rechazada por cuota no debe dejar categorías
        // huérfanas. Los updates de SKUs existentes pasan siempre (no consumen
        // cupo). Con el lock por tenant, `allowedNewCreations` es exacto.
        const existing = productBySku.get(sku);
        if (!existing && createdCount >= allowedNewCreations) {
          if (!limitReached) {
            console.warn(
              `[storelink][catalog-import] tenant ${tenantId}: cupo del plan agotado (${catalogLimit}); filas nuevas restantes omitidas`
            );
          }
          limitReached = true;
          errorCount++;
          continue;
        }

        try {
          let categoryId: number | undefined;
          if (rawCategory) {
            const catSlug = rawCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            if (categoryCache.has(catSlug)) {
              categoryId = categoryCache.get(catSlug);
            } else {
              const existingCat = await payload.find({
                collection: 'categories',
                where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: catSlug } }] },
                limit: 1,
                overrideAccess: true,
              });
              if (existingCat.docs.length > 0) {
                categoryId = existingCat.docs[0].id;
                categoryCache.set(catSlug, categoryId);
              } else {
                const newCat = await payload.create({
                  collection: 'categories',
                  overrideAccess: true,
                  data: { name: rawCategory, slug: catSlug, tenant: tenantId },
                });
                categoryId = newCat.id;
                categoryCache.set(catSlug, categoryId);
              }
            }
          }

          const existing = productBySku.get(sku);
          if (existing) {
            const updated = await payload.update({
              collection: 'products',
              id: existing.id,
              overrideAccess: true,
              context: { skipRevalidate: true },
              data: {
                title,
                price,
                description,
                category: categoryId,
                imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
                // Auditoría 2026-09-04 (P2): si la hoja NO trae columna de stock
                // (stockQuantity === undefined), NO tocar trackStock/stockQuantity:
                // antes un re-sync sin columna stock ponía trackStock:false en
                // TODO el catálogo existente y desactivaba el control de
                // inventario en silencio (overselling). Solo se sobreescriben
                // cuando el CSV trae el dato. Payload ignora campos undefined.
                ...(stockQuantity !== undefined
                  ? {
                      stockQuantity,
                      trackStock: true,
                      stockStatus: stockQuantity === 0 ? ('out_of_stock' as const) : ('in_stock' as const),
                    }
                  : {}),
              },
            });
            productBySku.set(sku, updated as Product);
            updatedCount++;
          } else {
            // El gate de cuota de esta fila ya se resolvió ANTES de la resolución
            // de categoría (review Devin #84): llegar aquí implica que la fila
            // tiene cupo garantizado.
            const created = await payload.create({
              collection: 'products',
              overrideAccess: true,
              context: { skipRevalidate: true },
              data: {
                title,
                sku,
                price,
                description,
                imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
                category: categoryId,
                tenant: tenantId,
                stockQuantity,
                trackStock: stockQuantity !== undefined,
                stockStatus: stockQuantity === 0 ? 'out_of_stock' : 'in_stock',
              },
            });
            productBySku.set(sku, created as Product);
            createdCount++;
          }
        } catch (err) {
          console.warn(`[storelink][catalog-import] fila ${i + 1} fallida:`, err);
          errorCount++;
        }
      }

      try {
        revalidatePath(`/${tenantSlug}`);
      } catch {
        // Non-blocking en dev
      }

      // Auditoría final 2026-09-01 (P1): el import cambió precios/stock/imágenes
      // en bloque — invalidar el caché Redis/memoria del storefront además del
      // ISR, o los cambios no se ven hasta 3 min después.
      await invalidateProductsCache(tenantId);

      return { output: { created: createdCount, updated: updatedCount, errorCount, limitReached } };
    } finally {
      await releaseTenantImportLock(tenantId);
    }
  },
};

export const catalogImportJobs = {
  tasks: [catalogImportRows],
};

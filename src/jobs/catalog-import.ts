import type { TaskConfig } from 'payload';
import { revalidatePath } from 'next/cache';
import { sanitizeCsvCell, parseCSVLine } from '@/lib/csv';
import { isAllowedImageUrl, normalizeProductImageUrl } from '@/lib/image-hosts';
import { invalidateProductsCache } from '@/lib/storefront-cache';
import type { Category, Product } from '@/payload-types';

/**
 * Jobs Queue oficial de Payload 3 (mismo patrón que src/jobs/order-created.ts):
 * import de catálogo (CSV o Google Sheets, ambos llegan aquí como texto CSV
 * plano) movido FUERA del request síncrono de Vercel. Antes,
 * import-csv/route.ts y sync-sheets/route.ts procesaban hasta 5.000 filas
 * dentro del propio request — riesgo real de timeout de función serverless
 * en catálogos grandes (ver docs/HALLAZGOS_AUDITORIA_PROFUNDA_2026-08-29.md
 * §1). No se suma infraestructura nueva (Inngest/QStash/Vercel Queues): se
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
    { name: 'rejectedImageUrls', type: 'number' },
  ],
  handler: async ({ input, req }) => {
    const { payload } = req;
    const { tenantId, tenantSlug, csvText } = input as {
      tenantId: number;
      tenantSlug: string;
      csvText: string;
    };

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

    const existingProductsRes = await payload.find({
      collection: 'products',
      where: { tenant: { equals: tenantId } },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    });
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

    // Total de URLs de imagen descartadas en TODO el import (reporte al final).
    let totalRejectedImageUrls = 0;
    const rejectedImageSamples: string[] = [];

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
      //
      // Fix (PR imágenes por URL): el descarte YA NO es silencioso — se cuenta
      // y se reporta en el output del job (rejectedImageUrls) para que el
      // comerciante sepa que una foto no entró en vez de descubrirlo mirando
      // la tienda. La normalización de Drive (image-hosts) corre ANTES del
      // filtro, así que los formatos docs.google.com/uc?id=, /open?id=,
      // /thumbnail?id= y /file/d/ sí se rescatan y solo se descartan hosts
      // genuinamente no permitidos.
      const allImageCandidates =
        imgIdx !== -1 && cols[imgIdx]
          ? cols[imgIdx]
              .split(/[,;\n\r]+/)
              .map((u) => normalizeProductImageUrl(sanitizeCsvCell(u).trim()))
          : [];
      const imageUrls = allImageCandidates
        .filter((u) => {
          const ok = Boolean(u) && isAllowedImageUrl(u);
          if (!ok && u) {
            totalRejectedImageUrls++;
            if (rejectedImageSamples.length < 3) rejectedImageSamples.push(u);
          }
          return ok;
        })
        .slice(0, 6);

      if (!title) continue;

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
              stockQuantity,
              trackStock: stockQuantity !== undefined,
              stockStatus: stockQuantity === 0 ? 'out_of_stock' : 'in_stock',
            },
          });
          productBySku.set(sku, updated as Product);
          updatedCount++;
        } else {
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

    // Reporte de imágenes descartadas: el fallo silencioso es el peor tipo de
    // fallo para el comerciante (ve "una sola foto" sin saber por qué). Los
    // samples van al log del job para diagnóstico inmediato.
    if (totalRejectedImageUrls > 0) {
      console.warn(
        `[storelink][catalog-import] ${totalRejectedImageUrls} URL(s) de imagen descartadas por host no permitido. ` +
          `Hosts permitidos: ver src/lib/image-hosts.ts. Ejemplos: ${rejectedImageSamples.join(' | ')}`
      );
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

    return {
      output: {
        created: createdCount,
        updated: updatedCount,
        errorCount,
        rejectedImageUrls: totalRejectedImageUrls,
      },
    };
  },
};

export const catalogImportJobs = {
  tasks: [catalogImportRows],
};

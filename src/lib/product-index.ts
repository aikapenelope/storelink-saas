import type { Payload, PayloadRequest, Where } from 'payload';
import type { Product } from '@/payload-types';

/**
 * PR 10 (SPEC-20260907-10, thermo D1): índice de productos por SKU — helper
 * compartido entre el checkout (src/app/actions/checkout.ts §verifyAndPriceItems)
 * y el hook de inventario (src/collections/Orders.ts §fetchProductResolver).
 *
 * Antes, esta lógica vivía DUPLICADA en ambos archivos (misma query batch +
 * maps first-wins + fallback por SKU faltante): cada corrección de la
 * auditoría (PR #93 sort determinista, fallback individual) tuvo que
 * aplicarse DOS veces — riesgo de divergencia silenciosa en el par más
 * crítico del sistema (cobro vs. deducción de stock).
 *
 * Semántica PRESERVADA al 100% (requisito del roadmap: comportamiento y
 * firmas idénticos):
 *  - UNA query batch por tenant: `or: [{sku in}, {'variants.sku' in}]` con
 *    `sort: 'id'` determinista (PR #93/C4): ante duplicados históricos gana
 *    el MENOR id, siempre el mismo producto.
 *  - Maps first-wins: el primer doc (menor id) es dueño del SKU base y de
 *    cada SKU de variante (review Devin #93 ronda 2 "Duplicate catalogs
 *    debit the wrong product").
 *  - Fallback individual (review Devin #93 "Duplicate rows hide ordered
 *    products"): SKUs que el batch dejó fuera por duplicados se resuelven
 *    1-a-1 con `limit: 1, sort: 'id'` — ningún SKU del pedido queda sin
 *    resolución determinista.
 *
 * Patrón oficial: Local API `payload.find` con `and/or` + propiedades anidadas
 * (skill /payload QUERIES.md §andor-logic, §nested-properties) y `req`
 * threaded para participar de la transacción del caller cuando existe
 * (§ADAPTERS.md — el hook de Orders corre dentro de la tx del request).
 */

export interface ProductIndexBySku {
  /** Map SKU base → producto dueño (first-wins: menor id). */
  baseBySku: Map<string, Product>;
  /** Map SKU de variante → producto dueño (first-wins: menor id). */
  variantOwnerBySku: Map<string, Product>;
}

/**
 * Carga el índice de productos por SKU para una lista de SKUs.
 *
 * `tenantId` opcional: el hook de Orders lo recibe nullable desde docs
 * legacy (items sin tenant resoluble); sin tenant NO se filtra (comportamiento
 * previo idéntico). `req` opcional: con él la query comparte la sesión de la
 * transacción del request (atomicidad oficial); sin él corre aislada como
 * siempre en el checkout.
 */
export async function loadProductIndexBySku({
  payload,
  req,
  tenantId,
  skus,
}: {
  payload: Payload;
  req?: PayloadRequest;
  tenantId: number | string | null | undefined;
  skus: string[];
}): Promise<ProductIndexBySku> {
  const baseBySku = new Map<string, Product>();
  const variantOwnerBySku = new Map<string, Product>();

  const ingest = (doc: Product): void => {
    // Review Devin PR #93 ronda 2: first-wins — ante duplicados históricos
    // GANA EL PRIMERO (menor id, garantizado por sort:'id'), nunca el último.
    if (doc.sku && !baseBySku.has(doc.sku)) baseBySku.set(doc.sku, doc);
    for (const v of Array.isArray(doc.variants) ? doc.variants : []) {
      if (v.sku && !variantOwnerBySku.has(v.sku)) variantOwnerBySku.set(v.sku, doc);
    }
  };

  // Batch único: el `limit` acotado con `sort:'id'` hace la resolución
  // determinista; los SKUs que queden fuera se resuelven en el fallback.
  if (skus.length > 0) {
    const batchRes = await payload.find({
      collection: 'products',
      where: {
        and: [
          ...(tenantId ? [{ tenant: { equals: tenantId } } as Where] : []),
          { or: [{ sku: { in: skus } }, { 'variants.sku': { in: skus } }] },
        ],
      },
      limit: Math.max(skus.length, 1),
      // PR 3 (C4): sort determinista — si existieran SKUs duplicados por
      // error de captura, el "primero del find" debe ser SIEMPRE el mismo
      // (menor id = el más antiguo), no el que decida el plan de la query.
      sort: 'id',
      depth: 0,
      overrideAccess: true,
      ...(req ? { req } : {}),
    });
    for (const doc of batchRes.docs as Product[]) {
      ingest(doc);
    }

    // PR 3 (review Devin PR #93 "Duplicate rows hide ordered products"): el
    // batch con `limit` acotado puede dejar SKUs FUERA de la página cuando
    // existen duplicados históricos (varios docs para el mismo SKU llenan la
    // página) → el SKU quedaría sin resolución. Los faltantes se buscan
    // individualmente (1 fila, menor id) — determinista y sin huecos.
    const missingSkus = skus.filter(
      (s) => !baseBySku.has(s) && !variantOwnerBySku.has(s)
    );
    for (const missingSku of missingSkus) {
      const single = await payload.find({
        collection: 'products',
        where: {
          and: [
            ...(tenantId ? [{ tenant: { equals: tenantId } } as Where] : []),
            { or: [{ sku: { equals: missingSku } }, { 'variants.sku': { equals: missingSku } }] },
          ],
        },
        limit: 1,
        sort: 'id',
        depth: 0,
        overrideAccess: true,
        ...(req ? { req } : {}),
      });
      const doc = single.docs[0] as Product | undefined;
      if (doc) ingest(doc);
    }
  }

  return { baseBySku, variantOwnerBySku };
}

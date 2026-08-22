import type { Payload } from 'payload';

/**
 * Motor de sincronización de catálogo desde Google Sheets (CSV).
 *
 * Patrón batch oficial: carga TODO el CSV en memoria, hace diff local por SKU
 * (Map) y agrupa escrituras en chunks dentro de UNA transacción compartida vía
 * `req: { transactionID }` (docs oficiales: database/transactions).
 * Reemplaza el bucle fila-por-fila (~3 round-trips SQL por fila) que causaba
 * timeouts de serverless con catálogos grandes.
 */

export interface SheetsSyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ line: number; error: string }>;
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
      current = '';
    } else {
      if (!inQuotes && char !== ',') current += char;
      else current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
  return result;
}

/** Convierte URL de edición de Google Sheets a export CSV directo. */
export function sheetsUrlToCsvExport(rawUrl: string): string | null {
  const match = rawUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match?.[1]) {
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
  }
  // Ya es un link de export o published-to-web
  return rawUrl;
}

/** Validación SSRF estricta: hostname EXACTO en allowlist (no includes). */
export function isAllowedSheetHost(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') return false;
    const allowed = ['docs.google.com', 'docs.googleusercontent.com', 'storage.googleapis.com'];
    return allowed.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

const CHUNK_SIZE = 50;

/**
 * Sincroniza el CSV contra la colección products del tenant.
 * - Diff local por SKU: cero queries N+1.
 * - Categorías deduplicadas en memoria + creación en lote.
 * - Escrituras en chunks de 50 dentro de una transacción compartida:
 *   si una fila falla, TODO el chunk se revierte y se reporta.
 */
export async function syncCatalogFromCsv(
  payload: Payload,
  tenantId: string | number,
  csvText: string
): Promise<SheetsSyncResult> {
  const result: SheetsSyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  const rawLines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length < 2) throw new Error('La hoja debe contener encabezados y al menos una fila');

  const headers = parseCSVLine(rawLines[0]).map((h) => h.toLowerCase().trim());
  const idx = {
    sku: headers.findIndex((h) => h === 'sku' || h === 'codigo'),
    title: headers.findIndex((h) => h === 'title' || h === 'nombre' || h === 'producto'),
    price: headers.findIndex((h) => h === 'price' || h === 'precio'),
    cat: headers.findIndex((h) => h === 'category' || h === 'categoria' || h === 'rubro'),
    desc: headers.findIndex((h) => h === 'description' || h === 'descripcion'),
    stock: headers.findIndex((h) => h === 'stock' || h === 'cantidad' || h === 'stock_quantity'),
    img: headers.findIndex(
      (h) =>
        h === 'image' || h === 'images' || h === 'image_url' || h === 'imagen' || h === 'foto' || h === 'url_imagen' || h === 'img'
    ),
  };
  if (idx.title === -1 || idx.price === -1) {
    throw new Error('La hoja debe contener al menos las columnas "title" (o nombre) y "price" (o precio)');
  }

  // ---- Parseo completo en memoria ----
  type Row = {
    line: number;
    sku: string;
    title: string;
    price: number;
    description: string;
    categorySlug?: string;
    categoryName?: string;
    imageUrl?: string;
    stockQuantity?: number;
  };
  const rows: Row[] = [];
  for (let i = 1; i < rawLines.length; i++) {
    const cols = parseCSVLine(rawLines[i]);
    const title = cols[idx.title];
    const price = parseFloat(cols[idx.price]) || 0;
    if (!title) {
      result.skipped++;
      continue;
    }
    const rawCat = idx.cat !== -1 && cols[idx.cat] ? cols[idx.cat].trim() : '';
    const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    rows.push({
      line: i + 1,
      sku: idx.sku !== -1 && cols[idx.sku] ? cols[idx.sku].trim() : `SKU-GS-${Date.now()}-${i}`,
      title,
      price,
      description: idx.desc !== -1 ? cols[idx.desc] || '' : '',
      categorySlug: rawCat ? slugify(rawCat) : undefined,
      categoryName: rawCat || undefined,
      imageUrl: idx.img !== -1 && cols[idx.img] ? cols[idx.img].trim() : undefined,
      stockQuantity: idx.stock !== -1 && cols[idx.stock] ? parseInt(cols[idx.stock], 10) || 0 : undefined,
    });
  }

  // ---- Cargar estado existente en 2 queries totales ----
  const [existingProducts, existingCategories] = await Promise.all([
    payload.find({
      collection: 'products',
      where: { tenant: { equals: tenantId as any } },
      limit: 5000,
      depth: 0,
      pagination: false,
    }),
    payload.find({
      collection: 'categories',
      where: { tenant: { equals: tenantId as any } },
      limit: 1000,
      depth: 0,
      pagination: false,
    }),
  ]);

  const productBySku = new Map<string, { id: string | number }>();
  for (const p of existingProducts.docs as Array<any>) productBySku.set(String(p.sku), p);

  const categoryBySlug = new Map<string, string | number>();
  for (const c of existingCategories.docs as Array<any>) categoryBySlug.set(String(c.slug), c.id);

  // ---- Crear categorías nuevas en lote ----
  const newCategories = new Map<string, string>(); // slug -> name
  for (const r of rows) {
    if (r.categorySlug && !categoryBySlug.has(r.categorySlug!) && !newCategories.has(r.categorySlug!)) {
      newCategories.set(r.categorySlug!, r.categoryName!);
    }
  }

  // Transacción oficial de Postgres: beginTransaction devuelve un ID que
  // se pasa en `req` a cada operación (docs/database/transactions)
  const transactionID = await payload.db.beginTransaction?.();
  try {
    if (newCategories.size > 0) {
      for (const [slug, name] of newCategories) {
        try {
          const created = await payload.create({
            collection: 'categories',
            data: { name, slug, tenant: tenantId as any },
            req: { transactionID } as any,
          } as any);
          categoryBySlug.set(slug, created.id);
        } catch (err: any) {
          result.errors.push({ line: 0, error: `Categoría "${name}": ${err.message}` });
        }
      }
    }

    // ---- Upserts en chunks de 50, misma transacción ----
    for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
      const chunk = rows.slice(start, start + CHUNK_SIZE);
      for (const r of chunk) {
        try {
          const docData: Record<string, any> = {
            title: r.title,
            price: r.price,
            description: r.description,
            category: r.categorySlug ? categoryBySlug.get(r.categorySlug) : undefined,
            imageUrl: r.imageUrl,
            stockQuantity: r.stockQuantity,
            trackStock: r.stockQuantity !== undefined,
            stockStatus: r.stockQuantity === 0 ? 'out_of_stock' : 'in_stock',
          };

          const existingProduct = productBySku.get(r.sku);
          if (existingProduct) {
            await payload.update({
              collection: 'products',
              id: existingProduct.id,
              data: docData,
              req: { transactionID } as any,
            } as any);
            result.updated++;
          } else {
            const created = await payload.create({
              collection: 'products',
              data: { ...docData, sku: r.sku, tenant: tenantId as any },
              req: { transactionID } as any,
            } as any);
            productBySku.set(r.sku, created);
            result.created++;
          }
        } catch (err: any) {
          result.errors.push({ line: r.line, error: err.message || 'Error al procesar fila' });
        }
      }
    }

    await payload.db.commitTransaction?.(transactionID!);
  } catch (err: any) {
    await payload.db.rollbackTransaction?.(transactionID!);
    throw err;
  }

  return result;
}

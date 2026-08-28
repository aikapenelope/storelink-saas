import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
// assertTenantAccess eliminado: Sprint 2 — la autorización la gestiona
// Payload con user + overrideAccess: false (patrón oficial QUERIES.md §Local API)
import { sanitizeCsvCell, validateCsvLimits } from '@/lib/csv';
import { checkAdminRouteRateLimit } from '@/lib/rate-limit';
import type { Product } from '@/payload-types';

export const dynamic = 'force-dynamic';

function parseCSVLine(line: string): string[] {
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
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
  return result;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant: tenantSlug } = await params;

  try {
    const payload = await getPayload({ config });
    const headersList = await headers();
    const authResult = await payload.auth({ headers: headersList });
    if (!authResult.user) {
      return NextResponse.json(
        { error: 'No autorizado. Debes iniciar sesión como administrador para sincronizar productos.' },
        { status: 401 }
      );
    }

    // R8 (plan v2): anti-abuso por usuario autenticado — fail-open si Upstash
    // cae (decisión del dueño, lib/rate-limit). La importación es la ruta más
    // pesada: cota estricta de 2/min.
    const rlVerdict = await checkAdminRouteRateLimit('import-csv', authResult.user.id);
    if (!rlVerdict.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas importaciones seguidas. Espera un minuto e inténtalo de nuevo.' },
        { status: 429 }
      );
    }

    // 1. Find tenant — Sprint 2: user + overrideAccess: false (patrón oficial
    // QUERIES.md §Local API). El plugin multi-tenant aplica el constraint
    // { id: { in: tenantIds } } del usuario automáticamente. Si el slug no
    // pertenece a ningún tenant del usuario, el resultado es vacío → 404.
    // Se elimina assertTenantAccess manual: Payload lo gestiona aquí.
    const tenantResult = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      user: authResult.user,
      overrideAccess: false,
    });

    if (tenantResult.docs.length === 0) {
      return NextResponse.json(
        { error: `Tenant "${tenantSlug}" no encontrado` },
        { status: 404 }
      );
    }

    const tenantId = tenantResult.docs[0].id;

    // 2. Read CSV content (either as multipart form-data or raw text)
    let csvText = '';
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json(
          { error: 'No se incluyó ningún archivo CSV' },
          { status: 400 }
        );
      }
      csvText = await file.text();
    } else {
      csvText = await request.text();
    }

    if (!csvText || !csvText.trim()) {
      return NextResponse.json(
        { error: 'El archivo CSV está vacío' },
        { status: 400 }
      );
    }

    // Hardening CSV: límites de tamaño/filas antes de procesar (DoS) y
    // neutralización de fórmulas al almacenar (OWASP CSV injection).
    const rawLines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const limitCheck = validateCsvLimits(csvText, Math.max(0, rawLines.length - 1));
    if (!limitCheck.ok) {
      return NextResponse.json(
        { error: limitCheck.error },
        { status: 400 }
      );
    }
    if (rawLines.length < 2) {
      return NextResponse.json(
        { error: 'El CSV debe tener encabezados y al menos una fila de datos' },
        { status: 400 }
      );
    }

    const csvHeaders = parseCSVLine(rawLines[0]).map((h) => h.toLowerCase().trim());
    const skuIdx = csvHeaders.findIndex((h) => h === 'sku' || h === 'codigo');
    const titleIdx = csvHeaders.findIndex((h) => h === 'title' || h === 'nombre' || h === 'producto');
    const priceIdx = csvHeaders.findIndex((h) => h === 'price' || h === 'precio');
    const catIdx = csvHeaders.findIndex((h) => h === 'category' || h === 'categoria' || h === 'rubro');
    const descIdx = csvHeaders.findIndex((h) => h === 'description' || h === 'descripcion');
    const stockIdx = csvHeaders.findIndex((h) => h === 'stock' || h === 'cantidad' || h === 'stock_quantity');
    const imgIdx = csvHeaders.findIndex((h) => h === 'image' || h === 'images' || h === 'image_url' || h === 'imagen' || h === 'foto' || h === 'url_imagen' || h === 'img');

    if (titleIdx === -1 || priceIdx === -1) {
      return NextResponse.json(
        {
          error:
            'El CSV debe contener al menos las columnas "title" (o nombre) y "price" (o precio).',
          headersFound: csvHeaders,
        },
        { status: 400 }
      );
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errors: Array<{ line: number; error: string }> = [];

    // Cache categories to avoid duplicate finds/creates in loop
    const categoryCache = new Map<string, number>();

    // Pre-cargar productos existentes del tenant para eliminar N+1 queries.
    // user + overrideAccess: false: el plugin multi-tenant añade el constraint
    // de tenencia; el where explícito es defensa en profundidad adicional.
    const existingProductsRes = await payload.find({
      collection: 'products',
      where: {
        tenant: { equals: tenantId },
      },
      limit: 1000,
      depth: 0,
      user: authResult.user,
      overrideAccess: false,
    });

    const productBySku = new Map<string, Product>();
    for (const prod of existingProductsRes.docs as Product[]) {
      if (prod.sku) {
        productBySku.set(prod.sku, prod);
      }
    }

    for (let i = 1; i < rawLines.length; i++) {
      const cols = parseCSVLine(rawLines[i]);
      // Campos de texto persistidos SIEMPRE neutralizados (anti-fórmulas);
      // los numéricos se parsean aparte y no pasan por aquí.
      const title = sanitizeCsvCell(cols[titleIdx]);
      const price = parseFloat(cols[priceIdx]) || 0;
      const sku = skuIdx !== -1 && cols[skuIdx] ? sanitizeCsvCell(cols[skuIdx]) : `SKU-${Date.now()}-${i}`;
      const description = descIdx !== -1 ? sanitizeCsvCell(cols[descIdx]) : '';
      const stockQuantity = stockIdx !== -1 ? parseInt(cols[stockIdx], 10) || 0 : undefined;
      const rawCategory = catIdx !== -1 && cols[catIdx] ? sanitizeCsvCell(cols[catIdx]) : '';
      const imageUrl = imgIdx !== -1 && cols[imgIdx] ? sanitizeCsvCell(cols[imgIdx]) : undefined;

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
              where: {
                and: [
                  { tenant: { equals: tenantId } },
                  { slug: { equals: catSlug } },
                ],
              },
              limit: 1,
              user: authResult.user,
              overrideAccess: false,
            });
            if (existingCat.docs.length > 0) {
              categoryId = existingCat.docs[0].id;
              categoryCache.set(catSlug, categoryId);
            } else {
              const newCat = await payload.create({
                collection: 'categories',
                data: {
                  name: rawCategory,
                  slug: catSlug,
                  tenant: tenantId,
                },
                user: authResult.user,
                overrideAccess: false,
              });
              categoryId = newCat.id;
              categoryCache.set(catSlug, categoryId);
            }
          }
        }

        // Búsqueda O(1) en memoria en lugar de query individual por fila
        const existing = productBySku.get(sku);

        if (existing) {
          const updated = await payload.update({
            collection: 'products',
            id: existing.id,
            data: {
              title,
              price,
              description,
              category: categoryId,
              imageUrl: imageUrl || undefined,
              stockQuantity,
              trackStock: stockQuantity !== undefined,
              stockStatus: stockQuantity === 0 ? 'out_of_stock' : 'in_stock',
            },
            user: authResult.user,
            overrideAccess: false,
          });
          productBySku.set(sku, updated as Product);
          updatedCount++;
        } else {
          const created = await payload.create({
            collection: 'products',
            data: {
              title,
              sku,
              price,
              description,
              imageUrl: imageUrl || undefined,
              category: categoryId,
              tenant: tenantId,
              stockQuantity,
              trackStock: stockQuantity !== undefined,
              stockStatus: stockQuantity === 0 ? 'out_of_stock' : 'in_stock',
            },
            user: authResult.user,
            overrideAccess: false,
          });
          productBySku.set(sku, created as Product);
          createdCount++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al procesar fila';
        errors.push({ line: i + 1, error: msg });
      }
    }

    // Invalidar solo el storefront del tenant activo.
    // Sprint 3: revalidatePath('/') eliminado — invalidaba el cache de TODOS
    // los tenants de la plataforma en cada importación de catálogo.
    try {
      revalidatePath(`/${tenantSlug}`);
    } catch {
      // Non-blocking in dev
    }

    return NextResponse.json({
      success: true,
      message: `Importación completada para ${tenantResult.docs[0].name}`,
      created: createdCount,
      updated: updatedCount,
      totalProcessed: createdCount + updatedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch {
    return NextResponse.json(
      { error: 'Error interno del servidor durante la importación' },
      { status: 500 }
    );
  }
}

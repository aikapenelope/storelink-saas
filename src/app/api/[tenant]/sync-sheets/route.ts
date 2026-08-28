import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
// assertTenantAccess eliminado: Sprint 2 — la autorización la gestiona
// Payload con user + overrideAccess: false (patrón oficial QUERIES.md §Local API)
import { sanitizeCsvCell, validateCsvLimits, parseCSVLine } from '@/lib/csv';
import { checkAdminRouteRateLimit } from '@/lib/rate-limit';
import type { Category, Product } from '@/payload-types';

export const dynamic = 'force-dynamic';

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
    // cae (decisión del dueño, lib/rate-limit). La sincronización toca la API
    // de Google Sheets: cota de 4/min por usuario.
    const rlVerdict = await checkAdminRouteRateLimit('sync-sheets', authResult.user.id);
    if (!rlVerdict.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas sincronizaciones seguidas. Espera un minuto e inténtalo de nuevo.' },
        { status: 429 }
      );
    }

    // 1. Find tenant — Sprint 2: user + overrideAccess: false elimina el check
    // manual assertTenantAccess. Payload aplica el constraint multi-tenant
    // automáticamente; si el tenant no es del usuario → resultado vacío → 404.
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

    const body = await request.json().catch(() => ({}));
    let sheetUrl = body.url || body.sheetsUrl;

    if (!sheetUrl) {
      return NextResponse.json(
        { error: 'Debes proporcionar la URL de Google Sheets en el cuerpo JSON: { "url": "https://..." }' },
        { status: 400 }
      );
    }

    // SSRF Protection: solo URLs reales de Google Sheets (hostname EXACTO,
    // no substring — antes un `includes` permitía hosts atacantes), con
    // timeout y verificación del host final tras redirects.
    try {
      const parsed = new URL(sheetUrl);
      if (parsed.hostname !== 'docs.google.com' || !parsed.pathname.startsWith('/spreadsheets/')) {
        return NextResponse.json(
          { error: 'Solo se aceptan URLs de Google Sheets por seguridad.' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'URL de Google Sheets inválida.' },
        { status: 400 }
      );
    }

    // Automatically convert standard Google Sheets edit URL into direct CSV export link
    if (sheetUrl.includes('docs.google.com/spreadsheets/d/')) {
      const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        sheetUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
      }
    }

    // Fetch live CSV from Google Sheets (timeout + verificación del host final)
    let res: Response;
    try {
      res = await fetch(sheetUrl, {
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
    } catch (fetchErr) {
      console.warn('Sync sheets fetch error:', fetchErr);
      return NextResponse.json(
        { error: 'No se pudo descargar la hoja de cálculo. Revisa el enlace e inténtalo de nuevo.' },
        { status: 400 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `No se pudo descargar la hoja de cálculo (HTTP ${res.status}). Asegúrate de que el enlace de Google Sheets esté configurado como público ("Cualquiera con el enlace puede ver").`,
        },
        { status: 400 }
      );
    }

    const finalHost = res.url ? new URL(res.url).hostname : '';
    if (finalHost && finalHost !== 'docs.google.com') {
      return NextResponse.json(
        { error: 'La URL redirige fuera de Google Sheets y fue bloqueada por seguridad.' },
        { status: 400 }
      );
    }

    const csvText = await res.text();
    if (!csvText || !csvText.trim()) {
      return NextResponse.json(
        { error: 'La hoja de cálculo de Google Sheets está vacía' },
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
        { error: 'La hoja debe contener encabezados y al menos una fila' },
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
            'La hoja de Google Sheets debe contener al menos las columnas "title" (o nombre) y "price" (o precio).',
          headersFound: csvHeaders,
        },
        { status: 400 }
      );
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errors: Array<{ line: number; error: string }> = [];

    // Pre-cargar productos existentes del tenant (batch único, sin N+1).
    // Límite 5000 alineado con MAX_CSV_ROWS para que el pre-fetch cubra
    // siempre el 100% del catálogo → no se crean duplicados para SKUs existentes.
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

    // Pre-cargar categorías existentes del tenant para eliminar la query
    // individual por categoría en el loop. El cache se inicializa aquí con
    // todos los slugs del tenant → solo requiere 1 query de creación por
    // categoría genuinamente nueva (no vista antes en la hoja).
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
      // Campos de texto persistidos SIEMPRE neutralizados (anti-fórmulas);
      // los numéricos se parsean aparte y no pasan por aquí.
      const title = sanitizeCsvCell(cols[titleIdx]);
      const price = parseFloat(cols[priceIdx]) || 0;
      const sku = skuIdx !== -1 && cols[skuIdx] ? sanitizeCsvCell(cols[skuIdx]) : `SKU-GS-${Date.now()}-${i}`;
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

        // Lookup O(1) en el Map precargado — sin query individual por fila.
        // La autorización ya se aplicó en el prefetch (tenant scoped).
        const existingProd = productBySku.get(sku);

        if (existingProd) {
          const updated = await payload.update({
            collection: 'products',
            id: existingProd.id,
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
    // los tenants de la plataforma en cada sincronización de hoja.
    try {
      revalidatePath(`/${tenantSlug}`);
    } catch {
      // Non-blocking in dev
    }

    return NextResponse.json({
      success: true,
      message: `Sincronización con Google Sheets completada para ${tenantResult.docs[0].name}`,
      created: createdCount,
      updated: updatedCount,
      totalProcessed: createdCount + updatedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Sync sheets error:', err);
    return NextResponse.json(
      { error: 'Error interno durante la sincronización con Google Sheets' },
      { status: 500 }
    );
  }
}

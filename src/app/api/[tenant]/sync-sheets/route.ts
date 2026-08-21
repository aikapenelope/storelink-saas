import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

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

    // 1. Find tenant
    const tenantResult = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
    });

    if (tenantResult.docs.length === 0) {
      return NextResponse.json(
        { error: `Tenant "${tenantSlug}" no encontrado` },
        { status: 404 }
      );
    }

    const tenantId = tenantResult.docs[0].id;

    // 🔒 Multi-Tenant Authorization Check (Audit Fix #2.3)
    const currentUser = authResult.user as any;
    const isSuperAdmin = currentUser.role === 'super-admin';

    if (!isSuperAdmin) {
      const userDoc: any = await payload.findByID({
        collection: 'users',
        id: currentUser.id,
        depth: 1,
      });

      const allowedTenantIds = (userDoc?.tenants || []).map((t: any) =>
        typeof t.tenant === 'object' && t.tenant !== null ? t.tenant.id : t.tenant
      );

      if (!allowedTenantIds.includes(tenantId)) {
        return NextResponse.json(
          { error: 'No tienes permiso para modificar el catálogo de esta tienda.' },
          { status: 403 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    let sheetUrl = body.url || body.sheetsUrl;

    if (!sheetUrl) {
      return NextResponse.json(
        { error: 'Debes proporcionar la URL de Google Sheets en el cuerpo JSON: { "url": "https://..." }' },
        { status: 400 }
      );
    }

    // SSRF Protection: Only allow Google Sheets URLs
    if (!sheetUrl.includes('docs.google.com/spreadsheets') && !sheetUrl.includes('googleapis.com')) {
      return NextResponse.json(
        { error: 'Solo se aceptan URLs de Google Sheets por seguridad.' },
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

    // Fetch live CSV from Google Sheets
    const res = await fetch(sheetUrl, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(
        {
          error: `No se pudo descargar la hoja de cálculo (HTTP ${res.status}). Asegúrate de que el enlace de Google Sheets esté configurado como público ("Cualquiera con el enlace puede ver").`,
        },
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

    // Parse CSV rows
    const rawLines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
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

    // Cache categories to avoid duplicate finds/creates in loop
    const categoryCache = new Map<string, string | number>();

    for (let i = 1; i < rawLines.length; i++) {
      const cols = parseCSVLine(rawLines[i]);
      const title = cols[titleIdx];
      const price = parseFloat(cols[priceIdx]) || 0;
      const sku = skuIdx !== -1 && cols[skuIdx] ? cols[skuIdx] : `SKU-GS-${Date.now()}-${i}`;
      const description = descIdx !== -1 ? cols[descIdx] : '';
      const stockQuantity = stockIdx !== -1 ? parseInt(cols[stockIdx], 10) || 0 : undefined;
      const rawCategory = catIdx !== -1 && cols[catIdx] ? cols[catIdx].trim() : '';
      const imageUrl = imgIdx !== -1 && cols[imgIdx] ? cols[imgIdx].trim() : undefined;

      if (!title) continue;

      try {
        let categoryId: string | number | undefined;
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
                  tenant: tenantId as any,
                },
              });
              categoryId = newCat.id;
              categoryCache.set(catSlug, categoryId);
            }
          }
        }

        const existing = await payload.find({
          collection: 'products',
          where: {
            and: [
              { tenant: { equals: tenantId } },
              { sku: { equals: sku } },
            ],
          },
          limit: 1,
        });

        if (existing.docs.length > 0) {
          await payload.update({
            collection: 'products',
            id: existing.docs[0].id,
            data: {
              title,
              price,
              description,
              category: categoryId as any,
              imageUrl: imageUrl || undefined,
              stockQuantity,
              trackStock: stockQuantity !== undefined,
              stockStatus: stockQuantity === 0 ? 'out_of_stock' : 'in_stock',
            },
          });
          updatedCount++;
        } else {
          await payload.create({
            collection: 'products',
            data: {
              title,
              sku,
              price,
              description,
              imageUrl: imageUrl || undefined,
              category: categoryId as any,
              tenant: tenantId as any,
              stockQuantity,
              trackStock: stockQuantity !== undefined,
              stockStatus: stockQuantity === 0 ? 'out_of_stock' : 'in_stock',
            },
          });
          createdCount++;
        }
      } catch (err: any) {
        errors.push({ line: i + 1, error: err.message || 'Error al procesar fila' });
      }
    }

    // Instantly invalidate Vercel CDN cache for this merchant's storefront
    try {
      revalidatePath(`/${tenantSlug}`);
      revalidatePath('/');
    } catch (revalidateErr) {
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
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error durante la sincronización con Google Sheets' },
      { status: 500 }
    );
  }
}

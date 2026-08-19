import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@/payload.config';

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
    const body = await request.json().catch(() => ({}));
    let sheetUrl = body.url || body.sheetsUrl;

    if (!sheetUrl) {
      return NextResponse.json(
        { error: 'Debes proporcionar la URL de Google Sheets en el cuerpo JSON: { "url": "https://..." }' },
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

    // 1. Fetch live CSV from Google Sheets
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

    const payload = await getPayload({ config });

    // 2. Find tenant
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

    // 3. Parse CSV rows
    const rawLines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (rawLines.length < 2) {
      return NextResponse.json(
        { error: 'La hoja debe contener encabezados y al menos una fila' },
        { status: 400 }
      );
    }

    const headers = parseCSVLine(rawLines[0]).map((h) => h.toLowerCase().trim());
    const skuIdx = headers.findIndex((h) => h === 'sku' || h === 'codigo');
    const titleIdx = headers.findIndex((h) => h === 'title' || h === 'nombre' || h === 'producto');
    const priceIdx = headers.findIndex((h) => h === 'price' || h === 'precio');
    const descIdx = headers.findIndex((h) => h === 'description' || h === 'descripcion');
    const stockIdx = headers.findIndex((h) => h === 'stock' || h === 'cantidad' || h === 'stock_quantity');

    if (titleIdx === -1 || priceIdx === -1) {
      return NextResponse.json(
        {
          error:
            'La hoja de Google Sheets debe contener al menos las columnas "title" (o nombre) y "price" (o precio).',
          headersFound: headers,
        },
        { status: 400 }
      );
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errors: Array<{ line: number; error: string }> = [];

    for (let i = 1; i < rawLines.length; i++) {
      const cols = parseCSVLine(rawLines[i]);
      const title = cols[titleIdx];
      const price = parseFloat(cols[priceIdx]) || 0;
      const sku = skuIdx !== -1 && cols[skuIdx] ? cols[skuIdx] : `SKU-GS-${Date.now()}-${i}`;
      const description = descIdx !== -1 ? cols[descIdx] : '';
      const stockQuantity = stockIdx !== -1 ? parseInt(cols[stockIdx], 10) || 0 : undefined;

      if (!title) continue;

      try {
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

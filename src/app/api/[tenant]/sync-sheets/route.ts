import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { headers } from 'next/headers';
import { after } from 'next/server';
// assertTenantAccess eliminado: Sprint 2 — la autorización la gestiona
// Payload con user + overrideAccess: false (patrón oficial QUERIES.md §Local API)
import { validateCsvLimits, parseCSVLine } from '@/lib/csv';
import { checkAdminRouteRateLimit } from '@/lib/rate-limit';

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
    const isLegitimateGoogleSheetsHost =
      finalHost === 'docs.google.com' ||
      /[.-]sheets\.googleusercontent\.com$/.test(finalHost) ||
      finalHost.endsWith('.googleusercontent.com');
    if (finalHost && !isLegitimateGoogleSheetsHost) {
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

    // Solo se validan las columnas OBLIGATORIAS aquí (feedback inmediato al
    // admin); el resto de índices (sku, categoría, stock, imagen) se
    // resuelven de nuevo dentro del job (src/jobs/catalog-import.ts), que
    // recibe el mismo csvText y hace el parseo completo en background.
    const csvHeaders = parseCSVLine(rawLines[0]).map((h) => h.toLowerCase().trim());
    const titleIdx = csvHeaders.findIndex((h) => h === 'title' || h === 'nombre' || h === 'producto');
    const priceIdx = csvHeaders.findIndex((h) => h === 'price' || h === 'precio');

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

    // Jobs Queue oficial (src/jobs/catalog-import.ts): mismo task compartido
    // con import-csv/route.ts — la hoja ya llegó como texto CSV plano, así
    // que el procesamiento fila por fila es idéntico. Dual-dispatch como en
    // checkout.ts: ejecución instantánea vía after() + el runner externo
    // (.github/workflows/jobs-runner.yml) retoma si la función se corta a
    // mitad de una hoja grande.
    const job = await payload.jobs.queue({
      task: 'catalogImportRows',
      input: { tenantId, tenantSlug, csvText: rawLines.join('\n') },
    });

    after(async () => {
      try {
        await payload.jobs.runByID({ id: job.id });
      } catch (runErr) {
        console.error('Jobs run error (quedará en cola para el runner externo):', runErr);
      }
    });

    return NextResponse.json(
      {
        success: true,
        queued: true,
        jobId: job.id,
        message: `Sincronización en cola para ${tenantResult.docs[0].name}. Se reflejará en el catálogo en unos segundos.`,
      },
      { status: 202 }
    );
  } catch (err) {
    console.error('Sync sheets error:', err);
    return NextResponse.json(
      { error: 'Error interno durante la sincronización con Google Sheets' },
      { status: 500 }
    );
  }
}

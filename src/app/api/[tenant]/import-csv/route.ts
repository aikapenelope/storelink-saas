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
            'El CSV debe contener al menos las columnas "title" (o nombre) y "price" (o precio).',
          headersFound: csvHeaders,
        },
        { status: 400 }
      );
    }

    // Jobs Queue oficial (src/jobs/catalog-import.ts): el procesamiento fila
    // por fila corre en background, no dentro de este request. Dual-dispatch
    // idéntico al de checkout.ts — ejecución instantánea vía after() para el
    // caso feliz, y el runner externo (.github/workflows/jobs-runner.yml,
    // cada 5 min) retoma el job si la función se corta a mitad de un
    // catálogo grande. Evita el riesgo de timeout de Vercel en catálogos
    // grandes sin sumar infraestructura nueva.
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
        message: `Importación en cola para ${tenantResult.docs[0].name}. Se reflejará en el catálogo en unos segundos.`,
      },
      { status: 202 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Error interno del servidor durante la importación' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  parseCSVLine,
  sheetsUrlToCsvExport,
  isAllowedSheetHost,
  syncCatalogFromCsv,
} from '@/lib/sheets-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Sync manual (botón del panel). Usa el MISMO motor batch que el cron diario
 * (src/lib/sheets-sync.ts): diff local por SKU + escrituras en chunks dentro
 * de una transacción compartida. Sin queries N+1.
 */
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
    const tenantDoc = tenantResult.docs[0];

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

    // 2. URL del Sheet: body o la guardada en configuración programada
    const body = await request.json().catch(() => ({}));
    let sheetUrl = body.url || body.sheetsUrl || (tenantDoc as any).sheetsSyncUrl;

    if (!sheetUrl) {
      return NextResponse.json(
        { error: 'Debes proporcionar la URL de Google Sheets en el cuerpo JSON: { "url": "https://..." } o configurarla en Sincronización Automática.' },
        { status: 400 }
      );
    }

    // 🔒 SSRF Protection (Audit fix A4): hostname EXACTO en allowlist, https only
    if (!isAllowedSheetHost(sheetUrl)) {
      return NextResponse.json(
        { error: 'Solo se aceptan URLs de Google Sheets por seguridad.' },
        { status: 400 }
      );
    }

    // Convertir URL de edición a export CSV directo
    sheetUrl = sheetsUrlToCsvExport(sheetUrl)!;

    // 3. Descargar CSV
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

    // Validación temprana de encabezados para dar feedback inmediato
    const firstLine = csvText.split(/\r?\n/)[0] || '';
    const csvHeaders = parseCSVLine(firstLine).map((h) => h.toLowerCase().trim());
    const hasTitle = csvHeaders.some((h) => ['title', 'nombre', 'producto'].includes(h));
    const hasPrice = csvHeaders.some((h) => ['price', 'precio'].includes(h));
    if (!hasTitle || !hasPrice) {
      return NextResponse.json(
        {
          error:
            'La hoja de Google Sheets debe contener al menos las columnas "title" (o nombre) y "price" (o precio).',
          headersFound: csvHeaders,
        },
        { status: 400 }
      );
    }

    // 4. Motor batch compartido con el cron (diff local + chunks transaccionales)
    const result = await syncCatalogFromCsv(payload, tenantId, csvText);

    // Registrar resultado si este tenant tiene sync programado
    try {
      await payload.update({
        collection: 'tenants',
        id: String(tenantId),
        data: {
          syncLastStatus: result.errors.length > 0 ? 'partial_error' : 'ok',
          syncLastRunAt: new Date().toISOString(),
          syncLastResult: {
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            errorCount: result.errors.length,
            lastErrors: result.errors.slice(0, 5),
          },
        },
        depth: 0,
        overrideAccess: true,
        context: { disableRevalidate: false },
      } as any);
    } catch {
      /* no bloquear */
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
      message: `Sincronización con Google Sheets completada para ${tenantDoc.name}`,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      totalProcessed: result.created + result.updated,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error durante la sincronización con Google Sheets' },
      { status: 500 }
    );
  }
}

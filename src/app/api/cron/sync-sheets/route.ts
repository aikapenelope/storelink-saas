import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@/payload.config';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel: hasta 5 min en Pro para syncs grandes

/**
 * Endpoint de Vercel Cron — corre TODOS LOS DÍAS a las 12:00 UTC.
 *
 * Patrón recomendado para Jobs Queue en serverless (docs/jobs-queue/queues):
 * autoRun no es confiable en Vercel (la instancia duerme), así que el cron
 * de la plataforma invoca este endpoint, que:
 *  1. Encola un job `syncTenantCatalog` por cada tenant con sync activo
 *     (el schedule del task ya los encola diariamente; esto es refuerzo
 *     idempotente + cubre tenants nuevos creados después del deploy).
 *  2. Ejecuta inmediatamente los jobs pendientes de la cola `sheets-sync`.
 *
 * Seguridad: exige CRON_SECRET (header Authorization: Bearer) o sesión
 * super-admin. Vercel Cron envía el header automáticamente si el secret
 * está configurado como variable de entorno CRON_SECRET.
 */
async function authorize(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  // Fallback: sesión de super-admin desde el panel
  try {
    const payload = await getPayload({ config });
    const { headers } = await import('next/headers');
    const auth = await payload.auth({ headers: await headers() });
    return auth.user?.role === 'super-admin';
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const payload = await getPayload({ config });

  try {
    // 1. Encolar tenants habilitados que aún no tengan job hoy (idempotente)
    const { queueAllSheetsSyncs } = await import('@/jobs/syncTenantCatalog');
    const { queued } = await queueAllSheetsSyncs(payload);

    // 2. Ejecutar los jobs pendientes de la cola sheets-sync
    const runs = await payload.jobs.run({
      queue: 'sheets-sync',
      limit: 200,
      overrideAccess: true,
    } as any);

    return NextResponse.json({
      success: true,
      queued,
      executed: Array.isArray(runs) ? runs.length : undefined,
      message: `Sync diario 12:00 UTC: ${queued} tenant(s) encolados.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error ejecutando sincronización programada' },
      { status: 500 }
    );
  }
}

// GET también soportado (Vercel Cron hace GET por defecto)
export async function GET(request: NextRequest) {
  return POST(request);
}

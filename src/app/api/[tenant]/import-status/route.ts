import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { headers } from 'next/headers';

/**
 * Estado de un job de import de catálogo (catalogImportRows) para el panel
 * admin del comerciante (review Devin #72).
 *
 * Las rutas import-csv/sync-sheets responden 202 + jobId y procesan en
 * background (Jobs Queue, dual-dispatch con after()). Este endpoint permite al
 * cliente admin hacer polling del resultado real — created / updated /
 * rejectedImageUrls — en vez de mostrar un "en cola" genérico y perder las
 * advertencias de imágenes descartadas.
 *
 * Aislamiento multi-tenant: además de la sesión, se verifica que el job sea
 * taskSlug=catalogImportRows y que input.tenantId coincida con el tenant del
 * slug de la URL; cualquier discrepancia responde 404 (no se filtra existencia).
 *
 * Nota: con deleteJobOnComplete=false los completados persisten ~24h (los
 * purga /api/admin/cleanup-jobs), de modo que el output es legible durante el
 * polling. Un 404 aquí significa jobId inválido, de otro tenant o ya purgado.
 */

export const dynamic = 'force-dynamic';

type InternalJobsFind = (args: {
  collection: string;
  where?: Record<string, unknown>;
  limit?: number;
}) => Promise<{ docs?: Array<Record<string, unknown>> }>;

interface ImportOutput {
  created?: number;
  updated?: number;
  errorCount?: number;
  rejectedImageUrls?: number;
}

export async function GET(
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
        { error: 'No autorizado. Debes iniciar sesión como administrador.' },
        { status: 401 }
      );
    }

    // Mismo patrón que import-csv/sync-sheets: el plugin multi-tenant aplica
    // el constraint de tenants del usuario con overrideAccess: false.
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

    const jobIdRaw = request.nextUrl.searchParams.get('jobId') ?? '';
    const jobId = Number(jobIdRaw);
    if (!/^\d+$/.test(jobIdRaw) || !Number.isInteger(jobId) || jobId <= 0) {
      return NextResponse.json({ error: 'jobId inválido' }, { status: 400 });
    }

    // 'payload-jobs' es colección interna (no está en el union generado);
    // acceso directo por db como en JobsStatusView.tsx / cleanup-jobs.
    const jobsRes = await (payload.db as unknown as { find: InternalJobsFind }).find({
      collection: 'payload-jobs',
      where: { id: { equals: jobId } },
      limit: 1,
    });
    const job = jobsRes.docs?.[0];

    if (!job) {
      return NextResponse.json(
        { jobId, status: 'not_found' as const },
        { status: 404 }
      );
    }

    // Aislamiento: solo jobs de import de ESTE tenant.
    const jobTenantId = (job.input as { tenantId?: unknown } | undefined)?.tenantId;
    if (job.taskSlug !== 'catalogImportRows' || Number(jobTenantId) !== Number(tenantId)) {
      return NextResponse.json({ jobId, status: 'not_found' as const }, { status: 404 });
    }

    const hasError = job.hasError === true;
    const completedAt = typeof job.completedAt === 'string' ? job.completedAt : null;
    const processing = job.processing === true;
    const output = (job.output ?? null) as ImportOutput | null;

    const status: 'queued' | 'running' | 'completed' | 'error' = hasError
      ? 'error'
      : completedAt
        ? 'completed'
        : processing
          ? 'running'
          : 'queued';

    return NextResponse.json({
      jobId,
      status,
      output: status === 'completed' ? output : undefined,
    });
  } catch (err) {
    console.error('[storelink][import-status] error:', err);
    return NextResponse.json(
      { error: 'Error interno consultando el estado del import' },
      { status: 500 }
    );
  }
}
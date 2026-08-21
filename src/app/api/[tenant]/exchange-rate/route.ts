import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { revalidatePath } from 'next/cache';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: tenantSlug } = await params;
    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: request.headers });

    if (!user) {
      return NextResponse.json({ error: 'No autorizado. Debes iniciar sesión.' }, { status: 401 });
    }

    const body = await request.json();
    const { exchangeRateVES } = body;

    // Find tenant
    const tenantsRes = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
    });

    if (tenantsRes.docs.length === 0) {
      return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 });
    }

    const tenant = tenantsRes.docs[0];

    // Check user tenant access
    const isSuperAdmin = (user as any).role === 'super-admin';
    const userTenants = (user as any).tenants || [];
    const hasAccess =
      isSuperAdmin ||
      userTenants.some((t: any) => {
        const tid = typeof t.tenant === 'object' ? t.tenant.id : t.tenant;
        return tid === tenant.id;
      });

    if (!hasAccess) {
      return NextResponse.json({ error: 'No tienes permiso para modificar esta tienda.' }, { status: 403 });
    }

    const currentBranding = (tenant as any).branding || {};
    const newRate = exchangeRateVES !== undefined && exchangeRateVES !== null && Number(exchangeRateVES) > 0
      ? Number(exchangeRateVES)
      : null;

    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        branding: {
          ...currentBranding,
          exchangeRateVES: newRate,
        },
      },
    });

    // Revalidate paths across the platform
    try {
      revalidatePath(`/${tenantSlug}`);
      revalidatePath('/admin/analytics');
      revalidatePath('/admin');
    } catch (e) {
      // Ignored in edge cases
    }

    return NextResponse.json({
      success: true,
      tenantSlug,
      exchangeRateVES: newRate,
      message: newRate ? `Tasa actualizada a Bs. ${newRate.toFixed(2)} / $` : 'Tasa restablecida a modo automático en tiempo real.',
    });
  } catch (error: any) {
    console.error('Error updating exchange rate:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}

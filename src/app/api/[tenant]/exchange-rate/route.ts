import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { revalidatePath, revalidateTag } from 'next/cache';
import { assertTenantAccess } from '@/lib/utils';
import { checkAdminRouteRateLimit } from '@/lib/rate-limit';

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

    const rlVerdict = await checkAdminRouteRateLimit('exchange-rate', user.id);
    if (!rlVerdict.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas actualizaciones seguidas. Espera un momento antes de volver a intentar.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { exchangeRateVES } = body;

    // Find tenant — Sprint 2: user + overrideAccess: false para el lookup
    // inicial. El plugin multi-tenant aplica el constraint automáticamente;
    // si el slug no es del usuario → resultado vacío → 404 sin revelar existencia.
    const tenantsRes = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      user,
      overrideAccess: false,
    });

    if (tenantsRes.docs.length === 0) {
      return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 });
    }

    const tenant = tenantsRes.docs[0];

    // assertTenantAccess: se mantiene como defensa en profundidad porque el
    // update de abajo usa overrideAccess: true (ver comentario). Si en el
    // futuro el update se migra a overrideAccess: false, este check es redundante.
    if (!assertTenantAccess(user, tenant.id)) {
      return NextResponse.json({ error: 'No tienes permiso para modificar esta tienda.' }, { status: 403 });
    }

    // Cota superior de la tasa (evita Infinity / tasas absurdas que rompen
    // la serialización JSON y los totales de pedidos futuros)
    const rawRate = exchangeRateVES;
    let newRate: number | null = null;
    if (rawRate !== undefined && rawRate !== null) {
      const rateNum = Number(rawRate);
      if (!Number.isFinite(rateNum) || rateNum < 1 || rateNum > 100000) {
        return NextResponse.json({ error: 'Tasa de cambio inválida' }, { status: 400 });
      }
      newRate = rateNum;
    }

    // overrideAccess: true es intencional — Tenants.update es super-admin only;
    // la ruta autoriza vía assertTenantAccess + lookup overrideAccess:false.
    // Sprint 4: se elimina el spread { ...currentBranding, exchangeRateVES }.
    // Payload 3 hace deep merge en grupos — solo se actualiza el campo incluido
    // en data, atómico y sin race condition entre updates concurrentes en branding.
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        branding: {
          exchangeRateVES: newRate,
        },
      },
    });

    // Revalidate paths across the platform
    try {
      revalidatePath(`/${tenantSlug}`);
      revalidatePath('/admin/analytics');
      // Sprint 3: revalidatePath('/admin') eliminado — invalida todo el admin
      // panel de Payload cuando solo necesitamos las analíticas del tenant.
      revalidateTag('rate'); // Invalida la tasa cacheada del storefront (ISR)
    } catch {
      // Ignored in edge cases
    }

    return NextResponse.json({
      success: true,
      tenantSlug,
      exchangeRateVES: newRate,
      message: newRate ? `Tasa actualizada a Bs. ${newRate.toFixed(2)} / $` : 'Tasa restablecida a modo automático en tiempo real.',
    });
  } catch (error) {
    console.error('Error updating exchange rate:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

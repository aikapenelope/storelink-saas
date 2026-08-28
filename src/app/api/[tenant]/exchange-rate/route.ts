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

    const currentBranding = tenant.branding || {};

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

    // overrideAccess: true es intencional aquí: Tenants.update está restringido
    // a super-admin en el schema (los tenant-admins no pueden modificar todos
    // los campos de su tenant). La ruta hace su propia autorización vía
    // assertTenantAccess + el lookup con overrideAccess:false de arriba.
    // Pendiente (Sprint 4): añadir field-level access en branding.exchangeRateVES
    // para hasTenantAccess y migrar este update a overrideAccess: false.
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
      // Invalida la tasa cacheada del storefront (ISR)
      revalidateTag('rate');
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

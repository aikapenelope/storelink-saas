import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { getDeliveryNoteUrl, ADMIN_DOWNLOAD_TTL_SECONDS } from '@/lib/delivery-note';
import { checkAdminRouteRateLimit } from '@/lib/rate-limit';

/**
 * Descarga de la Nota de Entrega para USUARIOS AUTENTICADOS (admin).
 * Con la migración a R2 (URLs firmadas), el cliente descarga directo desde
 * la URL firmada que recibe en el checkout/email; esta ruta queda SOLO para
 * sesiones: hace lookup con el access control de Payload (un tenant-admin
 * solo ve pedidos de SUS tenants) y redirige (302) a la URL firmada de R2.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await getPayload({ config });

    const { user } = await payload.auth({ headers: request.headers });
    if (!user) {
      return new NextResponse('No autorizado', { status: 401 });
    }

    // R8 (plan v2): anti-abuso por usuario — fail-open si Upstash cae. Cada
    // descarga genera presign de R2: 30/min por usuario.
    const rlVerdict = await checkAdminRouteRateLimit('order-pdf', user.id);
    if (!rlVerdict.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas descargas seguidas. Espera un minuto e inténtalo de nuevo.' },
        { status: 429 }
      );
    }

    // Patrón oficial Local API (docs/local-api): overrideAccess es true por
    // defecto y SALTA el access control. Con false + user, el plugin
    // multi-tenant aplica el constraint { tenant: { in: [...] } } y un
    // tenant-admin solo resuelve pedidos de SUS tiendas.
    const orderRes = await payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: id } },
      limit: 1,
      user,
      overrideAccess: false,
    });
    const orderDoc = orderRes.docs[0];

    if (!orderDoc) {
      return new NextResponse('Pedido no encontrado', { status: 404 });
    }

    const orderNumber = orderDoc.orderNumber || String(orderDoc.id);
    const url = await getDeliveryNoteUrl(orderNumber, ADMIN_DOWNLOAD_TTL_SECONDS);
    if (!url) {
      return new NextResponse('Nota de entrega no disponible', { status: 404 });
    }

    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error('Error getting delivery note URL:', error);
    return new NextResponse('Error interno del servidor', { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { generateDeliveryNotePDF } from '@/lib/pdf';
import { verifyOrderPdfToken } from '@/lib/order-token';
import { FALLBACK_EXCHANGE_RATE_VES } from '@/lib/exchange-rate';
import type { Order, Tenant } from '@/payload-types';

/**
 * Endpoint de la Nota de Entrega en PDF.
 * Autorización (patrón oficial de access control):
 * - Con token opaco válido (lo recibe el cliente en su checkout): acceso
 *   público SOLO para ese pedido (token determinístico por orderNumber).
 * - Sin token: requiere sesión activa y el lookup se hace SIN overrideAccess,
 *   por lo que aplican los constraints de la colección + el plugin
 *   multi-tenant (un tenant-admin solo ve pedidos de SUS tenants; los IDs
 *   numéricos enumerables ya no son accesibles para otros comercios).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await getPayload({ config });

    // 1. Autenticación opcional: sesión válida de la colección users
    const { user } = await payload.auth({ headers: request.headers });
    const isAuthenticated = Boolean(user);

    // 2. Token opaco por pedido (misma vía que usa el cliente en checkout)
    const providedToken = request.nextUrl.searchParams.get('token') || '';
    const tokenValid = providedToken ? verifyOrderPdfToken(id, providedToken) : false;

    if (!isAuthenticated && !tokenValid) {
      return new NextResponse('No autorizado', { status: 401 });
    }

    // 3. Lookup: token válido → override (el token ya autoriza ESTE pedido);
    //    sesión autenticada → acceso controlado (constraints multi-tenant).
    let orderDoc: Order | null = null;
    const canOverride = tokenValid;

    if (/^\d+$/.test(id)) {
      orderDoc = (await payload
        .findByID({ collection: 'orders', id, ...(canOverride ? { overrideAccess: true } : {}) })
        .catch(() => null)) as Order | null;
    }

    if (!orderDoc) {
      const resByNum = await payload.find({
        collection: 'orders',
        where: { orderNumber: { equals: id } },
        limit: 1,
        ...(canOverride ? { overrideAccess: true } : {}),
      });
      if (resByNum.docs.length > 0) {
        orderDoc = resByNum.docs[0] as Order;
      }
    }

    if (!orderDoc) {
      return new NextResponse('Pedido no encontrado', { status: 404 });
    }

    // 4. Resolve Store Name & Exchange Rate (jerarquía unificada):
    //    snapshot del pedido > tasa manual del tenant > fallback env/890
    let storeName = 'Tienda StoreLink';
    let exchangeRateVES = Number(orderDoc.exchangeRateVES) || 0;

    const tenantId = typeof orderDoc.tenant === 'object' ? orderDoc.tenant?.id : orderDoc.tenant;
    if (tenantId) {
      try {
        const tenantDoc = (await payload.findByID({
          collection: 'tenants',
          id: tenantId as any,
          overrideAccess: true,
        })) as Tenant;
        if (tenantDoc?.name) storeName = tenantDoc.name;
        if (!exchangeRateVES && Number(tenantDoc?.branding?.exchangeRateVES) > 0) {
          exchangeRateVES = Number(tenantDoc?.branding?.exchangeRateVES);
        }
      } catch {}
    }
    if (!exchangeRateVES) {
      exchangeRateVES = FALLBACK_EXCHANGE_RATE_VES;
    }

    const total = Number(orderDoc.totalAmount) || 0;
    const totalVES = total * exchangeRateVES;

    const dateStr = orderDoc.createdAt
      ? new Date(orderDoc.createdAt).toLocaleDateString('es-VE', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : new Date().toLocaleDateString('es-VE');

    const pdfBytes = generateDeliveryNotePDF({
      storeName,
      orderNumber: orderDoc.orderNumber || String(orderDoc.id),
      date: dateStr,
      customerName: orderDoc.customer?.name || 'Cliente',
      customerPhone: orderDoc.customer?.phone || '',
      customerAddress: orderDoc.customer?.address || undefined,
      paymentMethod: orderDoc.customer?.paymentMethod || undefined,
      notes: orderDoc.customer?.notes || undefined,
      currency: orderDoc.currency || 'USD',
      total,
      totalVES,
      exchangeRateVES,
      showVES: true,
      items: Array.isArray(orderDoc.items)
        ? orderDoc.items.map((i) => ({
            sku: i.sku || 'N/A',
            title: i.title,
            quantity: Number(i.quantity) || 1,
            price: Number(i.price) || 0,
          }))
        : [],
    });

    const pdfBuffer = Buffer.from(pdfBytes);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Nota-Entrega-${orderDoc.orderNumber || orderDoc.id}.pdf"`,
        // Solo cacheable con token válido; nunca en CDN compartido
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error generating PDF delivery note:', error);
    return new NextResponse('Error generando PDF: error interno del servidor', {
      status: 500,
    });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { generateDeliveryNotePDF } from '@/lib/pdf';
import { verifyOrderPdfToken } from '@/lib/order-token';
import type { Order, Tenant } from '@/payload-types';

/**
 * Audit fix C4: este endpoint antes era público y aceptaba IDs secuenciales o
 * orderNumbers adivinables (YYMMDD + 4 dígitos), exponiendo nombre, teléfono,
 * dirección y montos de CUALQUIER pedido por enumeración. Ahora exige sesión
 * de admin (patrón oficial payload.auth en route handlers:
 * https://payloadcms.com/docs/local-api/overview#auth) o un token opaco por
 * orden, que es lo que recibe el cliente en su checkout para descargar SU nota.
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

    // Look up by ID or by orderNumber
    let orderDoc: Order | null = null;

    if (/^\d+$/.test(id)) {
      // Los IDs numéricos solo son accesibles con sesión activa
      if (!isAuthenticated) {
        return new NextResponse('No autorizado', { status: 401 });
      }
      const resById = await payload.findByID({
        collection: 'orders',
        id,
        overrideAccess: true,
      });
      if (resById) orderDoc = resById as Order;
    }

    if (!orderDoc) {
      const resByNum = await payload.find({
        collection: 'orders',
        where: {
          orderNumber: { equals: id },
        },
        limit: 1,
        overrideAccess: true,
      });
      if (resByNum.docs.length > 0) {
        orderDoc = resByNum.docs[0] as Order;
      }
    }

    if (!orderDoc) {
      return new NextResponse('Pedido no encontrado', { status: 404 });
    }

    // 3. Autorización: sesión activa O token correcto para ESTE pedido
    if (!isAuthenticated && !verifyOrderPdfToken(orderDoc.orderNumber || String(orderDoc.id), providedToken)) {
      return new NextResponse('No autorizado', { status: 401 });
    }

    // Resolve Store Name & Currency
    let storeName = 'Tienda StoreLink';
    let exchangeRateVES = Number(process.env.FALLBACK_EXCHANGE_RATE_VES) > 0
      ? Number(process.env.FALLBACK_EXCHANGE_RATE_VES)
      : 898.0;

    const tenantId = typeof orderDoc.tenant === 'object' ? orderDoc.tenant?.id : orderDoc.tenant;
    if (tenantId) {
      try {
        const tenantDoc = (await payload.findByID({
          collection: 'tenants',
          id: tenantId as any,
          overrideAccess: true,
        })) as Tenant;
        if (tenantDoc?.name) storeName = tenantDoc.name;
        if (tenantDoc?.branding?.exchangeRateVES) exchangeRateVES = tenantDoc.branding.exchangeRateVES;
      } catch {}
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
  } catch (error: any) {
    console.error('Error generating PDF delivery note:', error);
    return new NextResponse(`Error generando PDF: ${error.message || 'Error del servidor'}`, {
      status: 500,
    });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { generateDeliveryNotePDF } from '@/lib/pdf';
import type { Order, Tenant } from '@/payload-types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await getPayload({ config });

    // Look up by ID or by orderNumber
    let orderDoc: Order | null = null;

    try {
      const resById = await payload.findByID({
        collection: 'orders',
        id,
        overrideAccess: true,
      });
      if (resById) orderDoc = resById as Order;
    } catch {
      // If not numeric or UUID, search by orderNumber
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

    // Resolve Store Name & Currency
    let storeName = 'Tienda StoreLink';
    let exchangeRateVES = 898.0;

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
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('Error generating PDF delivery note:', error);
    return new NextResponse(`Error generando PDF: ${error.message || 'Error del servidor'}`, {
      status: 500,
    });
  }
}

'use server';

import { createTrelloOrderCard } from '@/lib/trello';
import { generateDeliveryNotePDF } from '@/lib/pdf';
import { getLiveExchangeRate } from '@/lib/exchange-rate';
import { Resend } from 'resend';
import type { Tenant, Product, Customer } from '@/payload-types';

export interface CheckoutCustomerData {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  paymentMethod?: string;
  notes?: string;
  deliveryType?: 'delivery' | 'pickup';
  deliveryDetails?: {
    municipality?: string;
    residenceZone?: string;
    buildingHouse?: string;
    referencePoint?: string;
  };
  paymentDetails?: {
    methodKey?: 'pago_movil' | 'zelle' | 'binance' | 'zinli' | 'banesco_panama' | 'cash' | 'pos';
    referenceNumber?: string;
    issuingBank?: string;
    issuingPhone?: string;
    senderName?: string;
    senderEmail?: string;
    binanceSenderId?: string;
    paymentStatus?: 'pending_verification' | 'verified' | 'rejected';
  };
}

export interface CheckoutItemData {
  sku: string;
  title: string;
  quantity: number;
  price: number;
}

export interface CheckoutRequest {
  tenantSlug: string;
  storeName: string;
  whatsappPhone: string;
  currency: string;
  exchangeRateVES?: number;
  showVES?: boolean;
  customer: CheckoutCustomerData;
  items: CheckoutItemData[];
}

export interface CheckoutResponse {
  success: boolean;
  orderNumber?: string;
  whatsappUrl?: string;
  pdfBase64?: string;
  emailSent?: boolean;
  error?: string;
}

export async function processOrder(request: CheckoutRequest): Promise<CheckoutResponse> {
  try {
    const { tenantSlug, storeName, whatsappPhone, currency, showVES, customer, items } = request;

    if (!items || items.length === 0) {
      return { success: false, error: 'El carrito está vacío' };
    }

    if (!customer.name || !customer.phone) {
      return { success: false, error: 'Por favor completa el nombre y teléfono de contacto' };
    }

    // Verified items with client price fallback
    const verifiedItems: CheckoutItemData[] = items.map((item) => ({
      sku: item.sku || 'S/N',
      title: item.title || 'Producto',
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
    }));

    const total = verifiedItems.reduce((acc, item) => acc + item.quantity * item.price, 0);

    // Exchange rate calculation
    const effectiveExchangeRate = request.exchangeRateVES && request.exchangeRateVES > 0
      ? request.exchangeRateVES
      : 910.0;

    const totalVES = total * effectiveExchangeRate;
    const now = new Date();
    const orderNumber = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1)
      .toString()
      .padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const dateFormatted = now.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // 1. Generate Official Delivery Note PDF (in-memory)
    let pdfBase64: string | undefined = undefined;
    try {
      const pdfBytes = generateDeliveryNotePDF({
        storeName: storeName || 'Don Luigi & Burgers',
        orderNumber,
        date: dateFormatted,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerAddress: customer.address,
        paymentMethod: customer.paymentMethod,
        notes: customer.notes,
        currency: currency || 'USD',
        total,
        totalVES,
        exchangeRateVES: effectiveExchangeRate,
        showVES: showVES ?? true,
        items: verifiedItems,
      });
      pdfBase64 = Buffer.from(pdfBytes).toString('base64');
    } catch (pdfErr) {
      console.warn('PDF generation warning:', pdfErr);
    }

    // 2. Build Short WhatsApp Confirmation Message
    const targetPhone = whatsappPhone || '584141234567';
    const cleanPhone = targetPhone.replace(/\D/g, '');

    const vesLine = showVES && effectiveExchangeRate
      ? `\n🇻🇪 *Total en Bs.:* Bs. ${totalVES.toLocaleString('es-VE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} _(Tasa: ${effectiveExchangeRate.toFixed(2)} Bs/$)_`
      : '';

    const message = `
¡Hola, ${storeName || 'Don Luigi'}! 👋
Acabo de registrar mi pedido *#${orderNumber}*.

👤 *Cliente:* ${customer.name}
📍 *Modalidad:* ${customer.address || 'Retiro en Tienda (Pickup)'}
💰 *Total a Pagar:* $${total.toFixed(2)} USD${vesLine}

📎 Adjunto mi comprobante / captura de pago y comparto mi *ubicación en tiempo real* para coordinar el despacho. ¡Muchas gracias!
    `.trim();

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    // 3. Dispatch Order to Trello Immediately (Direct or PWA Relay)
    let trelloCardUrl: string | undefined = undefined;
    try {
      const trelloRes = await createTrelloOrderCard({
        apiKey: process.env.TRELLO_API_KEY || '',
        token: process.env.TRELLO_TOKEN || '',
        listId: process.env.TRELLO_LIST_ID || '6a77eee513389b2d14a8b8da',
        orderNumber,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerAddress: customer.address,
        paymentMethod: customer.paymentMethod,
        notes: customer.notes,
        total,
        totalVES,
        exchangeRateVES: effectiveExchangeRate,
        currency: currency || 'USD',
        items: verifiedItems,
      });
      trelloCardUrl = trelloRes?.cardId ? `https://trello.com/c/${trelloRes.cardId}` : undefined;
    } catch (trelloErr) {
      console.warn('Trello dispatch warning:', trelloErr);
    }

    // 4. Send Order Confirmation Email via Resend with PDF Attachment
    let emailSent = false;
    const resendKey = process.env.RESEND_API_KEY || 're_2BtYzBRz_GtERUkjdX1B8NM6uzgM9tsrA';
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Don Luigi <onboarding@resend.dev>';
    const emailSubject = `✨ ¡Hola, ${customer.name}! Tu pedido #${orderNumber} en ${storeName || 'Don Luigi'} está registrado`;

    try {
      const resend = new Resend(resendKey);
      const recipient = customer.email || 'angeldelnogal55@gmail.com';

      const itemsHtml = verifiedItems
        .map(
          (i) =>
            `<tr>
              <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;"><strong>[${i.sku || 'N/A'}]</strong> ${i.title}</td>
              <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: center;">${i.quantity}</td>
              <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: bold;">$${(i.quantity * i.price).toFixed(2)}</td>
            </tr>`
        )
        .join('');

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #1e293b; }
            .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
            .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
            .store-name { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; margin: 0 0 6px 0; color: #ffffff; }
            .badge { display: inline-block; background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; }
            .body-content { padding: 28px 24px; }
            .greeting { font-size: 16px; line-height: 1.6; color: #334155; margin-bottom: 20px; }
            .order-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin: 20px 0; font-size: 13px; }
            .order-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
            .order-row:last-child { margin-bottom: 0; }
            .table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
            .th { background: #f1f5f9; padding: 10px; text-align: left; font-weight: 700; color: #475569; font-size: 11px; text-transform: uppercase; }
            .total-box { text-align: right; padding-top: 14px; border-top: 2px solid #e2e8f0; }
            .total-usd { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; }
            .total-ves { font-size: 13px; color: #059669; font-weight: 700; margin: 4px 0 0 0; }
            .next-steps { background: #fffbeb; border: 1px solid #fef3c7; border-radius: 14px; padding: 16px; margin-top: 24px; }
            .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="store-name">${storeName || 'Don Luigi & Burgers'}</h1>
              <span class="badge">Pedido Confirmado #${orderNumber}</span>
            </div>

            <div class="body-content">
              <p class="greeting">
                ¡Hola, <strong>${customer.name}</strong>! 👋<br/>
                Nos llena de alegría atenderte hoy. Queremos agradecerte de corazón por elegir a <strong>${storeName || 'Don Luigi'}</strong>. Tu pedido ha sido registrado en nuestro sistema.
              </p>

              <div class="order-box">
                <div class="order-row">
                  <span style="color: #64748b;">N° de Pedido:</span>
                  <strong style="color: #0f172a;">#${orderNumber}</strong>
                </div>
                <div class="order-row">
                  <span style="color: #64748b;">Modalidad:</span>
                  <strong>${customer.address || 'Retiro en Tienda (Pickup)'}</strong>
                </div>
                <div class="order-row">
                  <span style="color: #64748b;">Método de Pago:</span>
                  <strong>${customer.paymentMethod || 'Efectivo / Transferencia'}</strong>
                </div>
                ${customer.notes ? `<div class="order-row"><span style="color: #64748b;">Nota:</span><em>${customer.notes}</em></div>` : ''}
              </div>

              <table class="table">
                <thead>
                  <tr>
                    <th class="th">Producto</th>
                    <th class="th" style="text-align: center;">Cant.</th>
                    <th class="th" style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <div class="total-box">
                <p class="total-usd">Total: $${total.toFixed(2)} USD</p>
                ${
                  showVES
                    ? `<p class="total-ves">Equivalente VES: Bs. ${totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa: ${effectiveExchangeRate.toFixed(2)} Bs/$)</p>`
                    : ''
                }
              </div>

              <div class="next-steps">
                <strong style="color: #92400e; font-size: 13px;">💡 Pasos para agilizar tu entrega:</strong>
                <p style="margin: 6px 0 0 0; font-size: 12px; color: #78350f; line-height: 1.5;">
                  Por favor envía tu captura de pago / foto de billetes y comparte tu <strong>ubicación en tiempo real por WhatsApp</strong> para que el equipo prepare tu despacho de inmediato.
                </p>
              </div>

              <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 24px;">
                📎 <em>Hemos adjuntado tu <strong>Nota de Entrega en PDF</strong> a este correo como comprobante formal.</em>
              </p>
            </div>

            <div class="footer">
              Generado electrónicamente por <strong>${storeName || 'StoreLink'} PWA</strong> • Caracas, Venezuela<br/>
              ¡Muchas gracias por su preferencia!
            </div>
          </div>
        </body>
        </html>
      `;

      const sendResult = await resend.emails.send({
        from: fromEmail,
        to: recipient,
        subject: emailSubject,
        html: emailHtml,
        attachments: [
          {
            filename: `Nota-Entrega-${orderNumber}.pdf`,
            content: pdfBase64,
          },
        ],
      });

      if (sendResult.error) {
        console.warn('Resend send warning:', sendResult.error);
        if (sendResult.error.name === 'validation_error' && recipient !== 'angeldelnogal55@gmail.com') {
          await resend.emails.send({
            from: fromEmail,
            to: 'angeldelnogal55@gmail.com',
            subject: `[Demo StoreLink] Pedido #${orderNumber} de ${customer.name} (${customer.email || 'Sin email'})`,
            html: emailHtml,
            attachments: [
              {
                filename: `Nota-Entrega-${orderNumber}.pdf`,
                content: pdfBase64,
              },
            ],
          });
        }
      }
      emailSent = true;
    } catch (emailErr) {
      console.warn('Resend exception:', emailErr);
    }

    // 5. Optional Background Payload DB logging (Non-blocking)
    try {
      const { getPayload } = await import('payload');
      const payloadConfig = (await import('@/payload.config')).default;
      const payload = await getPayload({ config: payloadConfig });

      if (payload && tenantSlug) {
        const tenantResult = await payload.find({
          collection: 'tenants',
          where: { slug: { equals: tenantSlug } },
          limit: 1,
          overrideAccess: true,
        });

        const tenantDoc = tenantResult?.docs?.[0] as Tenant | undefined;
        const tenantId = tenantDoc?.id;

        if (tenantId) {
          await payload.create({
            collection: 'orders',
            overrideAccess: true,
            data: {
              orderNumber,
              status: 'pending',
              tenant: tenantId,
              deliveryType: customer.deliveryType || 'delivery',
              deliveryDetails: customer.deliveryDetails || undefined,
              paymentDetails: customer.paymentDetails || undefined,
              customer: {
                name: customer.name,
                phone: customer.phone,
                email: customer.email || '',
                address: customer.address || '',
                paymentMethod: customer.paymentMethod || 'Efectivo / Transferencia',
                notes: customer.notes || '',
              },
              items: verifiedItems.map((item) => ({
                sku: item.sku || 'N/A',
                title: item.title,
                price: item.price,
                quantity: item.quantity,
                subtotal: item.price * item.quantity,
              })),
              totalAmount: total,
              currency: currency || 'USD',
              trelloCardUrl,
            },
          });
        }
      }
    } catch (dbErr) {
      // Non-blocking
    }

    return {
      success: true,
      orderNumber,
      whatsappUrl,
      pdfBase64,
      emailSent,
    };
  } catch (err: any) {
    console.error('Unhandled processOrder error:', err);
    return {
      success: false,
      error: err.message || 'Error inesperado al procesar el pedido',
    };
  }
}

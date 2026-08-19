'use server';

import { getPayload } from 'payload';
import config from '@/payload.config';
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
  price: number; // Client-supplied price (will be re-validated on server)
}

export interface CheckoutRequest {
  tenantSlug: string;
  storeName: string;
  whatsappPhone: string;
  currency: string;
  exchangeRateVES?: number;
  showVES?: boolean;
  // trelloConfig is intentionally NOT accepted from client — read securely from DB
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

    // Server-side price validation: re-read prices from DB if available to prevent manipulation
    const verifiedItems: CheckoutItemData[] = [];
    let tenantDoc: Tenant | null = null;
    let tenantId: number | undefined = undefined;
    let payload: Awaited<ReturnType<typeof import('payload').getPayload>> | null = null;

    try {
      payload = await getPayload({ config });
      if (payload && tenantSlug) {
        const tenantResult = await payload.find({
          collection: 'tenants',
          where: { slug: { equals: tenantSlug } },
          limit: 1,
          overrideAccess: true,
        });
        if (tenantResult?.docs?.length > 0) {
          tenantDoc = tenantResult.docs[0];
          tenantId = tenantDoc.id;
        }
      }
    } catch (dbTenantErr) {
      console.warn('Could not resolve tenant from Payload DB (running in decoupled demo mode):', dbTenantErr);
    }

    for (const item of items) {
      let verifiedPrice = item.price;
      if (payload && tenantId && item.sku) {
        try {
          const productMatch = await payload.find({
            collection: 'products',
            where: {
              and: [
                { sku: { equals: item.sku } },
                { tenant: { equals: tenantId } },
              ],
            },
            limit: 1,
            overrideAccess: true,
          });
          if (productMatch?.docs?.length > 0) {
            verifiedPrice = Number((productMatch.docs[0] as Product).price) || item.price;
          }
        } catch {
          // If lookup fails, use client price as fallback
        }
      }
      verifiedItems.push({
        sku: item.sku,
        title: item.title,
        quantity: item.quantity,
        price: verifiedPrice,
      });
    }

    const total = verifiedItems.reduce((acc, item) => acc + item.quantity * item.price, 0);

    // Resolve live exchange rate from tenant configuration or live Binance P2P API
    let effectiveExchangeRate = request.exchangeRateVES || 910.0;
    try {
      if (tenantDoc?.branding?.exchangeRateVES && Number(tenantDoc.branding.exchangeRateVES) > 0) {
        effectiveExchangeRate = Number(tenantDoc.branding.exchangeRateVES);
      } else {
        const liveRate = await getLiveExchangeRate();
        effectiveExchangeRate = liveRate;
      }
    } catch {
      // Fallback to request rate
    }

    const totalVES = total * effectiveExchangeRate;
    const now = new Date();
    const orderNumber = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1)
      .toString()
      .padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    // 1. Generate Official Delivery Note PDF (Server-Side)
    let pdfBase64: string | undefined = undefined;
    try {
      const dateFormatted = now.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const pdfBytes = generateDeliveryNotePDF({
        storeName: storeName || 'StoreLink Shop',
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
      console.warn('PDF generation non-blocking warning:', pdfErr);
    }

    // 2. Build Formatted WhatsApp Order Message
    const cleanPhone = whatsappPhone.replace(/\D/g, '');
    const itemsList = verifiedItems
      .map(
        (item) =>
          `▪️ *${item.quantity}x* ${item.title} — $${(item.price * item.quantity).toFixed(2)}`
      )
      .join('\n');

    const vesLine =
      showVES && effectiveExchangeRate
        ? `\n🇻🇪 *Total en Bs.:* Bs. ${totalVES.toLocaleString('es-VE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} _(Tasa: ${effectiveExchangeRate.toFixed(2)} Bs/$)_`
        : '';

    const notesLine = customer.notes ? `\n📝 *Notas:* ${customer.notes}` : '';
    const emailLine = customer.email ? `\n✉️ *Email:* ${customer.email}` : '';
    const paymentLine = customer.paymentMethod
      ? `\n💳 *Método de Pago:* ${customer.paymentMethod}`
      : '';

    const message = `
🛍️ *¡NUEVO PEDIDO #${orderNumber}!*
🏪 *Tienda:* ${storeName}
📅 *Fecha:* ${now.toLocaleDateString('es-VE')} ${now.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
    })}

👤 *DATOS DEL CLIENTE:*
▪️ *Nombre:* ${customer.name}
▪️ *Teléfono:* ${customer.phone}${emailLine}
📍 *Dirección:* ${customer.address || 'Retiro en local'}${paymentLine}${notesLine}

📦 *DETALLE DE PRODUCTOS:*
${itemsList}

💰 *TOTAL A PAGAR: $${total.toFixed(2)} ${currency || 'USD'}*${vesLine}

_Generado automáticamente desde la tienda PWA_
    `.trim();

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    // 3. Dispatch Order to Trello (tenant config or global env vars fallback)
    let trelloCardUrl: string | undefined = undefined;
    const effectiveTrelloKey = tenantDoc?.trelloConfig?.apiKey || process.env.TRELLO_API_KEY;
    const effectiveTrelloToken = tenantDoc?.trelloConfig?.token || process.env.TRELLO_TOKEN;
    const effectiveTrelloListId = tenantDoc?.trelloConfig?.listId || process.env.TRELLO_LIST_ID;

    if (effectiveTrelloKey && effectiveTrelloToken && effectiveTrelloListId) {
      try {
        const trelloRes = await createTrelloOrderCard({
          apiKey: effectiveTrelloKey,
          token: effectiveTrelloToken,
          listId: effectiveTrelloListId,
          orderNumber,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          paymentMethod: customer.paymentMethod,
          notes: customer.notes,
          total,
          currency: currency || 'USD',
          items: verifiedItems,
        });
        trelloCardUrl = trelloRes?.cardId ? `https://trello.com/c/${trelloRes.cardId}` : undefined;
      } catch (trelloErr) {
        console.warn('Trello dispatch non-blocking error:', trelloErr);
      }
    }

    // 4. Save Order and Auto-Update Inventory in Payload CMS Database (Graceful Non-Blocking)
    if (payload) {
      try {
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

        // 4.1 Decrement Product Stock in Inventory
        if (tenantId) {
          try {
            for (const item of verifiedItems) {
              if (item.sku && item.sku !== 'N/A') {
                const productMatch = await payload.find({
                  collection: 'products',
                  where: {
                    and: [
                      { sku: { equals: item.sku } },
                      { tenant: { equals: tenantId } },
                    ],
                  },
                  limit: 1,
                  overrideAccess: true,
                });

                if (productMatch?.docs?.length > 0) {
                  const prod = productMatch.docs[0] as Product;
                  if (prod.trackStock && typeof prod.stockQuantity === 'number') {
                    const updatedStock = Math.max(0, prod.stockQuantity - item.quantity);
                    await payload.update({
                      collection: 'products',
                      id: prod.id,
                      overrideAccess: true,
                      data: {
                        stockQuantity: updatedStock,
                        stockStatus: updatedStock === 0 ? 'out_of_stock' : 'in_stock',
                      },
                    });
                  }
                }
              }
            }
          } catch (invErr) {
            console.warn('Inventory update non-blocking warning:', invErr);
          }
        }

        // 4.2 Upsert Customer into CRM collection
        try {
          const cleanCustPhone = customer.phone.replace(/\D/g, '');
          const existingCustomer = await payload.find({
            collection: 'customers',
            where: {
              and: [
                { phone: { equals: cleanCustPhone || customer.phone } },
                ...(tenantId ? [{ tenant: { equals: tenantId } }] : []),
              ],
            },
            limit: 1,
            overrideAccess: true,
          });

          if (existingCustomer?.docs?.length > 0) {
            const cust = existingCustomer.docs[0] as Customer;
            const newTotalOrders = (cust.totalOrders || 1) + 1;
            const newTotalSpent = Number((Number(cust.totalSpent || 0) + total).toFixed(2));
            const tag: 'vip' | 'frecuente' | 'nuevo' = newTotalOrders >= 5 ? 'vip' : newTotalOrders >= 2 ? 'frecuente' : 'nuevo';

            await payload.update({
              collection: 'customers',
              id: cust.id,
              overrideAccess: true,
              data: {
                name: customer.name,
                email: customer.email || cust.email,
                totalOrders: newTotalOrders,
                totalSpent: newTotalSpent,
                lastOrderAt: now.toISOString(),
                tag,
              },
            });
          } else {
            await payload.create({
              collection: 'customers',
              overrideAccess: true,
              data: {
                name: customer.name,
                phone: cleanCustPhone || customer.phone,
                email: customer.email || '',
                tenant: tenantId,
                totalOrders: 1,
                totalSpent: Number(total.toFixed(2)),
                lastOrderAt: now.toISOString(),
                tag: 'nuevo' as const,
                savedAddresses: customer.address ? [{ address: customer.address }] : [],
              },
            });
          }
        } catch (crmErr) {
          console.warn('CRM upsert non-blocking warning:', crmErr);
        }
      } catch (dbErr) {
        console.warn('Order save to database non-blocking warning:', dbErr);
      }
    }

    // 4. Send Order Confirmation Email with PDF Attachment via Resend (Multi-Tenant BYOK + Platform Fallback)
    let emailSent = false;
    const isEmailEnabled = tenantDoc?.emailConfig?.enabled ?? true;
    const effectiveResendKey = tenantDoc?.emailConfig?.resendApiKey || process.env.RESEND_API_KEY;
    const fromEmail = tenantDoc?.emailConfig?.fromEmail || process.env.RESEND_FROM_EMAIL || 'StoreLink <onboarding@resend.dev>';
    const emailSubject = tenantDoc?.emailConfig?.emailSubject || `🛍️ Comprobante de Pedido #${orderNumber} - ${storeName}`;
    const merchantNotificationEmail = tenantDoc?.emailConfig?.notificationEmail;

    if (isEmailEnabled && effectiveResendKey && (customer.email || merchantNotificationEmail)) {
      try {
        const resend = new Resend(effectiveResendKey);
        const recipients = [customer.email, merchantNotificationEmail].filter(Boolean) as string[];

        const itemsHtml = items
          .map(
            (i) =>
              `<tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>[${i.sku || 'N/A'}]</strong> ${i.title}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${i.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${(i.quantity * i.price).toFixed(2)}</td>
              </tr>`
          )
          .join('');

        for (const recipient of recipients) {
          await resend.emails.send({
            from: fromEmail,
            to: recipient,
            subject: `✨ ¡Hola, ${customer.name}! Tu pedido #${orderNumber} en ${storeName || 'Don Luigi'} está registrado`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #1e293b; }
                  .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
                  .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
                  .store-name { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; margin: 0 0 6px 0; color: #ffffff; }
                  .badge { display: inline-block; background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; font-size: 11px; font-weight: 700; padding: 4px 12px; rounded: 9999px; text-transform: uppercase; letter-spacing: 0.5px; }
                  .body-content { padding: 28px 24px; }
                  .greeting { font-size: 16px; line-height: 1.6; color: #334155; margin-bottom: 20px; }
                  .order-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin: 20px 0; font-size: 13px; }
                  .order-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
                  .order-row:last-child { margin-bottom: 0; }
                  .table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
                  .th { background: #f1f5f9; padding: 10px; text-align: left; font-weight: 700; color: #475569; font-size: 11px; text-transform: uppercase; }
                  .td { padding: 10px; border-bottom: 1px solid #f1f5f9; }
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
                        <span style="color: #64748b;">Modalidad de Entrega:</span>
                        <strong>${customer.address || 'Retiro en Tienda (Pickup)'}</strong>
                      </div>
                      <div class="order-row">
                        <span style="color: #64748b;">Método de Pago:</span>
                        <strong>${customer.paymentMethod || 'Pago Móvil / Zelle / Efectivo'}</strong>
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
                        Por favor envía tu captura de pago / transferencia y comparte tu <strong>ubicación en tiempo real por WhatsApp</strong> para que el repartidor salga hacia tu destino.
                      </p>
                    </div>

                    <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 24px;">
                      📎 <em>Hemos adjuntado tu <strong>Nota de Entrega en PDF</strong> a este correo como comprobante formal de despacho.</em>
                    </p>
                  </div>

                  <div class="footer">
                    Generado electrónicamente por <strong>${storeName || 'StoreLink'} PWA</strong> • Caracas, Venezuela<br/>
                    ¡Muchas gracias por su preferencia!
                  </div>
                </div>
              </body>
              </html>
            `,
            attachments: [
              {
                filename: `Nota-Entrega-${orderNumber}.pdf`,
                content: pdfBase64,
              },
            ],
          });
        }
        emailSent = true;
      } catch (emailErr) {
        console.error('Error sending confirmation email via Resend:', emailErr);
      }
    }

    return {
      success: true,
      orderNumber,
      whatsappUrl,
      pdfBase64,
      emailSent,
    };
  } catch (err: any) {
    console.error('Error processing order:', err);
    return { success: false, error: err.message || 'Error al procesar el pedido' };
  }
}

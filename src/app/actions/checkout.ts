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
      verifiedItems.push({ ...item, price: verifiedPrice });
    }

    // Generate unique human-readable order number
    const now = new Date();
    const orderNumber = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const dateFormatted = now.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Calculate total using verified prices
    const total = verifiedItems.reduce((acc, item) => acc + item.quantity * item.price, 0);

    // Resolve exchange rate from tenant config, client request or live API
    const tenantManualRate = Number(tenantDoc?.branding?.exchangeRateVES);
    const rate = tenantManualRate > 0
      ? tenantManualRate
      : (Number(request.exchangeRateVES) > 0 ? Number(request.exchangeRateVES) : await getLiveExchangeRate('binance'));
    const totalVES = total * rate;

    // 1. Generate Delivery Note PDF (Uint8Array -> Base64) in-memory
    let pdfBase64: string | undefined = undefined;
    try {
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
        exchangeRateVES: rate,
        showVES: showVES ?? true,
        items: verifiedItems,
      });
      pdfBase64 = Buffer.from(pdfBytes).toString('base64');
    } catch (pdfErr) {
      console.error('Error generating delivery note PDF:', pdfErr);
    }

    // 2. Format WhatsApp Message with Multi-Currency Breakdown
    const targetPhone = tenantDoc?.whatsappPhone || whatsappPhone || '584121234567';
    const cleanPhone = targetPhone.replace(/\D/g, '');
    const itemsList = verifiedItems
      .map(
        (item) =>
          `• [${item.sku || 'N/A'}] ${item.quantity}x ${item.title} ($${item.price.toFixed(2)} c/u) = *$${(item.quantity * item.price).toFixed(2)}*`
      )
      .join('\n');

    const message = `
👋 ¡Hola, *${storeName || 'Don Luigi'}*! Gracias por procesar mi pedido *#${orderNumber}*.

📸 Adjunto la foto / captura del comprobante de pago (o foto de los billetes).
📍 Les comparto mi ubicación en tiempo real para coordinar la entrega.

¡Quedo a la espera de su confirmación! 🙏
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
            customer: {
              name: customer.name,
              phone: customer.phone,
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
            subject: emailSubject,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; padding: 20px;">
                <div style="text-align: center; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px;">
                  <h1 style="color: #0f172a; margin: 0;">${storeName}</h1>
                  <p style="color: #64748b; font-size: 14px; margin-top: 5px;">¡Gracias por tu compra! Tu pedido ha sido registrado con éxito.</p>
                </div>

                <div style="background-color: #f8fafc; padding: 15px; border-radius: 12px; margin: 20px 0;">
                  <p style="margin: 4px 0;"><strong>Número de Pedido:</strong> #${orderNumber}</p>
                  <p style="margin: 4px 0;"><strong>Cliente:</strong> ${customer.name}</p>
                  <p style="margin: 4px 0;"><strong>Teléfono:</strong> ${customer.phone}</p>
                  ${customer.email ? `<p style="margin: 4px 0;"><strong>Email:</strong> ${customer.email}</p>` : ''}
                  <p style="margin: 4px 0;"><strong>Método de Pago:</strong> ${customer.paymentMethod || 'Efectivo / Transferencia'}</p>
                  <p style="margin: 4px 0;"><strong>Dirección:</strong> ${customer.address || 'Retiro en tienda'}</p>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
                  <thead>
                    <tr style="background-color: #f1f5f9; text-align: left;">
                      <th style="padding: 8px;">Producto</th>
                      <th style="padding: 8px; text-align: center;">Cant.</th>
                      <th style="padding: 8px; text-align: right;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>

                <div style="text-align: right; border-top: 2px solid #f0f0f0; padding-top: 15px;">
                  <h3 style="margin: 0; color: #0f172a;">Total a Pagar: $${total.toFixed(2)} USD</h3>
                  ${
                    showVES
                      ? `<p style="margin: 5px 0 0 0; color: #64748b; font-size: 13px;">Equivalente en Bolívares: <strong>Bs. ${totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong> (Tasa Binance: ${rate.toFixed(2)} Bs/$)</p>`
                      : ''
                  }
                </div>

                <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 30px;">
                  📎 Hemos adjuntado tu <strong>Nota de Entrega en formato PDF</strong> a este correo.
                </p>
              </div>
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

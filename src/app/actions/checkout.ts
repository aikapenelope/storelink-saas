'use server';

import { getPayload } from 'payload';
import config from '@/payload.config';
import { createTrelloOrderCard } from '@/lib/trello';
import { generateDeliveryNotePDF } from '@/lib/pdf';

export interface CheckoutCustomerData {
  name: string;
  phone: string;
  address?: string;
  paymentMethod?: string;
  notes?: string;
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
  trelloConfig?: {
    apiKey?: string;
    token?: string;
    listId?: string;
  };
  customer: CheckoutCustomerData;
  items: CheckoutItemData[];
}

export interface CheckoutResponse {
  success: boolean;
  orderNumber?: string;
  whatsappUrl?: string;
  pdfBase64?: string;
  error?: string;
}

export async function processOrder(request: CheckoutRequest): Promise<CheckoutResponse> {
  try {
    const { tenantSlug, storeName, whatsappPhone, currency, exchangeRateVES, showVES, trelloConfig, customer, items } = request;

    if (!items || items.length === 0) {
      return { success: false, error: 'El carrito está vacío' };
    }

    if (!customer.name || !customer.phone) {
      return { success: false, error: 'Por favor completa el nombre y teléfono de contacto' };
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

    const total = items.reduce((acc, item) => acc + item.quantity * item.price, 0);
    const rate = exchangeRateVES || 56.5;
    const totalVES = total * rate;

    // 1. Generate Delivery Note PDF (Uint8Array -> Base64)
    const pdfBytes = generateDeliveryNotePDF({
      storeName: storeName || 'StoreLink Shop',
      orderNumber,
      date: dateFormatted,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      paymentMethod: customer.paymentMethod,
      currency: currency || 'USD',
      total,
      items,
    });

    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    // 2. Dispatch Order to Merchant's Trello Board if configured
    let trelloCardUrl: string | undefined = undefined;
    if (trelloConfig?.apiKey && trelloConfig?.token && trelloConfig?.listId) {
      const trelloRes = await createTrelloOrderCard({
        apiKey: trelloConfig.apiKey,
        token: trelloConfig.token,
        listId: trelloConfig.listId,
        orderNumber,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerAddress: customer.address,
        paymentMethod: customer.paymentMethod,
        notes: customer.notes,
        total,
        currency,
        items,
      });
      trelloCardUrl = trelloRes?.cardId ? `https://trello.com/c/${trelloRes.cardId}` : undefined;
    }

    // 3. Save Order and Auto-Update Inventory in Payload CMS Database
    try {
      const payload = await getPayload({ config });

      let tenantId: any = undefined;
      const tenantResult = await payload.find({
        collection: 'tenants',
        where: {
          slug: {
            equals: tenantSlug,
          },
        },
        limit: 1,
      });

      if (tenantResult.docs.length > 0) {
        tenantId = tenantResult.docs[0].id;
      }

      await payload.create({
        collection: 'orders',
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
          items: items.map((item) => ({
            sku: item.sku || 'N/A',
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.price * item.quantity,
          })),
          totalAmount: total,
          currency: currency || 'USD',
          trelloCardUrl,
        } as any,
      });

      // 3.1 Decrement Product Stock in Inventory
      try {
        for (const item of items) {
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
            });

            if (productMatch.docs.length > 0) {
              const prod = productMatch.docs[0] as any;
              if (prod.trackStock && typeof prod.stockQuantity === 'number') {
                const updatedStock = Math.max(0, prod.stockQuantity - item.quantity);
                await payload.update({
                  collection: 'products',
                  id: prod.id,
                  data: {
                    stockQuantity: updatedStock,
                    stockStatus: updatedStock === 0 ? 'out_of_stock' : 'in_stock',
                  } as any,
                });
              }
            }
          }
        }
      } catch (invErr) {
        console.error('Error updating product inventory:', invErr);
      }

      // 3.2 Upsert Customer into CRM collection
      try {
        const existingCustomer = await payload.find({
          collection: 'customers',
          where: {
            and: [
              { phone: { equals: customer.phone } },
              { tenant: { equals: tenantId } },
            ],
          },
          limit: 1,
        });

        if (existingCustomer.docs.length > 0) {
          const cust = existingCustomer.docs[0] as any;
          const newTotalOrders = (cust.totalOrders || 1) + 1;
          const newTotalSpent = Number((Number(cust.totalSpent || 0) + total).toFixed(2));
          const tag = newTotalOrders >= 5 ? 'vip' : newTotalOrders >= 2 ? 'frecuente' : 'nuevo';

          await payload.update({
            collection: 'customers',
            id: cust.id,
            data: {
              name: customer.name,
              totalOrders: newTotalOrders,
              totalSpent: newTotalSpent,
              lastOrderAt: now.toISOString(),
              tag,
            } as any,
          });
        } else {
          await payload.create({
            collection: 'customers',
            data: {
              name: customer.name,
              phone: customer.phone,
              tenant: tenantId,
              totalOrders: 1,
              totalSpent: Number(total.toFixed(2)),
              lastOrderAt: now.toISOString(),
              tag: 'nuevo',
              savedAddresses: customer.address ? [{ address: customer.address }] : [],
            } as any,
          });
        }
      } catch (crmErr) {
        console.error('Error updating customer CRM record:', crmErr);
      }
    } catch (dbErr) {
      console.error('Error saving order record to Payload database:', dbErr);
    }

    // 4. Format WhatsApp Message with Multi-Currency Breakdown
    const cleanPhone = whatsappPhone.replace(/\D/g, '');
    const itemsList = items
      .map(
        (item) =>
          `• [${item.sku || 'N/A'}] ${item.quantity}x ${item.title} ($${item.price.toFixed(2)} c/u) = *$${(item.quantity * item.price).toFixed(2)}*`
      )
      .join('\n');

    const vesLine = (showVES ?? true)
      ? `\n🇻🇪 *Equivalente en Bolívares:* Bs. ${totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa: ${rate.toFixed(2)} Bs/$)`
      : '';

    const message = `
🛍️ *NUEVO PEDIDO #${orderNumber}*
🏪 *Tienda:* ${storeName}

👤 *DATOS DEL CLIENTE:*
• *Nombre:* ${customer.name}
• *Teléfono:* ${customer.phone}
• *Dirección:* ${customer.address || 'Retiro en tienda'}
• *Método de Pago:* ${customer.paymentMethod || 'Efectivo / Transferencia'}
${customer.notes ? `• *Notas:* ${customer.notes}\n` : ''}
📦 *PRODUCTOS:*
${itemsList}

💰 *TOTAL A PAGAR: $${total.toFixed(2)} ${currency}*${vesLine}

_Generado automáticamente desde la tienda PWA_
    `.trim();

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    return {
      success: true,
      orderNumber,
      whatsappUrl,
      pdfBase64,
    };
  } catch (err: any) {
    console.error('Error processing order:', err);
    return { success: false, error: err.message || 'Error al procesar el pedido' };
  }
}

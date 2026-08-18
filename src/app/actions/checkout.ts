'use server';

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
    const { tenantSlug, storeName, whatsappPhone, currency, trelloConfig, customer, items } = request;

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
    if (trelloConfig?.apiKey && trelloConfig?.token && trelloConfig?.listId) {
      await createTrelloOrderCard({
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
    }

    // 3. Format WhatsApp Message
    const cleanPhone = whatsappPhone.replace(/\D/g, '');
    const itemsList = items
      .map(
        (item) =>
          `• [${item.sku || 'N/A'}] ${item.quantity}x ${item.title} ($${item.price.toFixed(2)} c/u) = *$${(item.quantity * item.price).toFixed(2)}*`
      )
      .join('\n');

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

💰 *TOTAL A PAGAR: $${total.toFixed(2)} ${currency}*

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

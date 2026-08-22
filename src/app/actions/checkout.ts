'use server';

import { generateDeliveryNotePDF } from '@/lib/pdf';
import { resolveExchangeRateVES } from '@/lib/exchange-rate';
import { orderPdfToken } from '@/lib/order-token';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { revalidatePath } from 'next/cache';
import type { Tenant, Product, Customer } from '@/payload-types';
import { sanitizePlainText } from '@/lib/order-email';

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
  /** Nombres de las opciones de modificadores seleccionadas (resueltas en el servidor) */
  modifiers?: string[];
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
  /** Token opaco para descargar la nota PDF sin sesión: /api/orders/{orderNumber}/pdf?token=... */
  pdfToken?: string;
  pdfUrl?: string;
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

    // ------------------------------------------------------------------
    // 1. Initialize Payload Local API and Fetch Tenant (Official Pattern)
    // ------------------------------------------------------------------
    const payload = await getPayload({ config });

    const tenantResult = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      overrideAccess: true,
    });

    const tenantDoc = tenantResult?.docs?.[0] as Tenant | undefined;
    const tenantId = tenantDoc?.id;

    // ------------------------------------------------------------------
    // 2. Server-Side Price & Stock Verification (Fraud Prevention)
    // Patrón oficial adaptado de `defaultProductsValidation` del plugin
    // oficial @payloadcms/plugin-ecommerce (packages/plugin-ecommerce/
    // src/utilities/defaultProductsValidation.ts): precio requerido desde
    // la BD, stock suficiente, y rechazo de productos no verificados.
    // ------------------------------------------------------------------
    const verifiedItems: CheckoutItemData[] = [];

    for (const item of items) {
      // Cantidad: entero positivo acotado (evita -5 → $inc: +5 y abuso)
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
        return { success: false, error: 'Cantidad inválida en el carrito' };
      }

      // Todo item debe resolver a un producto REAL del tenant (el SKU y el
      // precio los decide el servidor, nunca el cliente). El lookup acepta
      // SKU base o SKU de variante (el catálogo permite variantes).
      if (!tenantId || !item.sku) {
        return { success: false, error: 'Producto no disponible' };
      }

      const dbProductRes = await payload.find({
        collection: 'products',
        where: {
          and: [
            { tenant: { equals: tenantId } },
            {
              or: [
                { sku: { equals: item.sku } },
                { 'variants.sku': { equals: item.sku } },
              ],
            },
          ],
        },
        limit: 1,
        overrideAccess: true,
      });

      if (dbProductRes.docs.length === 0) {
        return { success: false, error: `Producto no disponible: ${item.sku}` };
      }

      const dbProd = dbProductRes.docs[0] as Product;

      // Precio y stock desde el servidor: si el SKU es de una variante, se
      // usan el precio y stock de la variante; si no, los del producto base.
      let basePrice = Number(dbProd.price) || 0;
      let stockAvailable: number | null =
        dbProd.trackStock && typeof dbProd.stockQuantity === 'number' ? dbProd.stockQuantity : null;
      const matchedVariant = Array.isArray(dbProd.variants)
        ? dbProd.variants.find((v) => v.sku === item.sku)
        : undefined;
      if (matchedVariant) {
        if (typeof matchedVariant.price === 'number') basePrice = matchedVariant.price;
        if (typeof matchedVariant.stockQuantity === 'number') stockAvailable = matchedVariant.stockQuantity;
      }

      // Modificadores: el servidor resuelve los deltas por nombre de opción
      // (nunca se confía en el precio que envía el cliente).
      let modifiersDelta = 0;
      if (item.modifiers && item.modifiers.length > 0) {
        const optionList = Array.isArray(dbProd.modifiers)
          ? dbProd.modifiers.flatMap((g) => (Array.isArray(g.options) ? g.options : []))
          : [];
        for (const optionName of item.modifiers) {
          const option = optionList.find((o) => o.name === optionName);
          if (!option) {
            return { success: false, error: `Opción no disponible: ${optionName}` };
          }
          modifiersDelta += Number(option.priceDelta) || 0;
        }
      }

      const finalPrice = basePrice + modifiersDelta;

      // Validación de stock previa a la venta (el descuento atómico $inc lo
      // aplica el hook de inventario dentro de la transacción del pedido)
      if (stockAvailable !== null && stockAvailable < qty) {
        return {
          success: false,
          error: `Disculpe, solo quedan ${stockAvailable} unidades disponibles de "${dbProd.title}".`,
        };
      }

      verifiedItems.push({
        sku: item.sku,
        // El título con personalizaciones lo genera el cliente (solo display;
        // se escapa al renderizar en email/PDF/WhatsApp)
        title: item.title || dbProd.title,
        quantity: qty,
        price: finalPrice,
      });
    }

    const total = verifiedItems.reduce((acc, item) => acc + item.quantity * item.price, 0);
    if (total <= 0) {
      return { success: false, error: 'El total del pedido es inválido' };
    }

    // ------------------------------------------------------------------
    // 3. Resolve Exchange Rate — UNA sola resolución para TODO el pedido
    // (PDF, WhatsApp, email y documento Orders). Jerarquía oficial:
    //    tenant manual > Binance live > fallback env/890
    // ------------------------------------------------------------------
    const effectiveExchangeRate = await resolveExchangeRateVES(tenantDoc);

    const totalVES = total * effectiveExchangeRate;
    const now = new Date();
    let orderNumber = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1)
        .toString()
        .padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(
        100000 + Math.random() * 900000
      )}`;
      const clash = await payload.find({
        collection: 'orders',
        where: { orderNumber: { equals: candidate } },
        limit: 1,
        overrideAccess: true,
      });
      if (clash.docs.length === 0) {
        orderNumber = candidate;
        break;
      }
    }
    if (!orderNumber) {
      return { success: false, error: 'No se pudo generar un número de pedido único. Intenta de nuevo.' };
    }

    const dateFormatted = now.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // ------------------------------------------------------------------
    // 4. Generate Official Delivery Note PDF (in-memory)
    // ------------------------------------------------------------------
    let pdfBase64: string | undefined = undefined;
    try {
      const pdfBytes = generateDeliveryNotePDF({
        storeName: tenantDoc?.name || storeName || 'Flow Store',
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

    // ------------------------------------------------------------------
    // 5. Build Structured WhatsApp Message
    // ------------------------------------------------------------------
    const targetPhone = tenantDoc?.whatsappPhone || whatsappPhone || '584141234567';
    const cleanPhone = targetPhone.replace(/\D/g, '');

    const itemsSummary = verifiedItems
      .map((item) => `• ${item.quantity}x ${sanitizePlainText(item.title)} ($${(item.quantity * item.price).toFixed(2)})`)
      .join('\n');

    const paymentLabel = customer.paymentDetails?.methodKey
      ? customer.paymentDetails.methodKey.replace('_', ' ').toUpperCase()
      : customer.paymentMethod || 'PAGO ELECTRÓNICO';

    // Audit fix A5: todos los datos del cliente van sanitizados — un cliente
    // no puede inyectar líneas falsas ("TOTAL A PAGAR: $0") en el mensaje.
    const safeName = sanitizePlainText(customer.name);
    const safePhone = customer.phone.trim().replace(/[^\d+\s-]/g, '');
    const safeNotes = sanitizePlainText(customer.notes);
    const safeAddress = sanitizePlainText(customer.address);
    const safeBuilding = sanitizePlainText(customer.deliveryDetails?.buildingHouse);
    const safeMunicipality = sanitizePlainText(customer.deliveryDetails?.municipality);
    const safeReference = sanitizePlainText(customer.paymentDetails?.referenceNumber);

    const whatsappMessage = `👋 *¡Nuevo Pedido #${orderNumber}!*
🏪 *Comercio:* ${tenantDoc?.name || storeName}

👤 *Cliente:* ${safeName}
📱 *Teléfono:* ${safePhone}
${customer.email ? `📧 *Correo:* ${sanitizePlainText(customer.email)}\n` : ''}🛵 *Modalidad:* ${customer.deliveryType === 'pickup' ? 'Retiro en Tienda (Pickup)' : 'Delivery'}
${safeAddress ? `📍 *Dirección:* ${safeAddress}\n` : ''}${safeBuilding ? `🏢 *Edif/Casa:* ${safeBuilding}\n` : ''}${safeMunicipality ? `🗺️ *Municipio:* ${safeMunicipality}\n` : ''}💳 *Método de Pago:* ${paymentLabel}
${safeReference ? `🔢 *N° Referencia:* ${safeReference}\n` : ''}${safeNotes ? `📝 *Nota:* ${safeNotes}\n` : ''}
🛒 *Productos:*
${itemsSummary}

💰 *TOTAL A PAGAR:*
💵 *$${total.toFixed(2)} USD*
${showVES ? `🇻🇪 *Bs. ${totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}* (Tasa: ${effectiveExchangeRate.toFixed(2)} Bs/$)\n` : ''}
📄 _He generado mi Nota de Entrega en PDF. Por favor confirma la recepción._`;

    // Token opaco para que ESTE cliente descargue SU nota sin sesión
    const pdfToken = orderPdfToken(orderNumber);
    const pdfUrlWithToken = `/api/orders/${orderNumber}/pdf?token=${pdfToken}`;

    const whatsappUrl = `https://wa.me/${cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone}`}?text=${encodeURIComponent(
      whatsappMessage
    )}`;

    // ------------------------------------------------------------------
    // 6. Dispatch Trello + Email — AHORA ASÍNCRONO vía Jobs Queue oficial
    // de Payload (https://payloadcms.com/docs/jobs-queue/overview):
    // el workflow `order-created` (src/jobs/order-created.ts) crea la tarjeta
    // de Trello y envía el correo con el PDF, con reintentos y sin bloquear
    // el checkout. El cron de Vercel ejecuta /api/payload-jobs/run.
    // ------------------------------------------------------------------

    // ------------------------------------------------------------------
    // 8. Upsert Customer in CRM Collection & Tagging (Atomic Sync)
    // ------------------------------------------------------------------
    if (tenantId) {
      try {
        const cleanPhone = customer.phone.trim();
        const existingCustomerRes = await payload.find({
          collection: 'customers',
          where: {
            and: [
              { tenant: { equals: tenantId } },
              { phone: { equals: cleanPhone } },
            ],
          },
          limit: 1,
          overrideAccess: true,
        });

        if (existingCustomerRes.docs.length > 0) {
          const existingCust = existingCustomerRes.docs[0] as Customer;
          const newOrdersCount = (Number(existingCust.totalOrders) || 0) + 1;
          const newSpent = (Number(existingCust.totalSpent) || 0) + total;
          const newTag: 'vip' | 'frecuente' | 'nuevo' =
            newOrdersCount >= 3 || newSpent >= 50 ? 'vip' : 'frecuente';

          await payload.update({
            collection: 'customers',
            id: existingCust.id,
            overrideAccess: true,
            data: {
              name: customer.name || existingCust.name,
              email: customer.email || existingCust.email,
              totalOrders: newOrdersCount,
              totalSpent: newSpent,
              tag: newTag,
              lastOrderAt: now.toISOString(),
            },
          });
        } else {
          await payload.create({
            collection: 'customers',
            overrideAccess: true,
            data: {
              name: customer.name,
              phone: cleanPhone,
              email: customer.email || '',
              tenant: tenantId as any,
              totalOrders: 1,
              totalSpent: total,
              tag: 'nuevo',
              lastOrderAt: now.toISOString(),
            },
          });
        }
      } catch (crmErr) {
        console.warn('CRM upsert warning:', crmErr);
      }

      // ------------------------------------------------------------------
      // 9. Persist Order in Orders Collection
      // ------------------------------------------------------------------
      try {
        const orderDoc = await payload.create({
          collection: 'orders',
          overrideAccess: true,
          data: {
            orderNumber,
            status: 'pending',
            tenant: tenantId as any,
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
            // Snapshot de la tasa aplicada — conciliación exacta por pedido
            exchangeRateVES: effectiveExchangeRate,
          },
        });

        // Despacho asíncrono oficial (Jobs Queue): Trello + email con PDF.
        // El workflow `order-created` actualiza trelloCardUrl cuando termine.
        try {
          await payload.jobs.queue({
            workflow: 'order-created',
            input: { orderId: orderDoc.id as number },
          });
        } catch (queueErr) {
          // Visible en logs: un fallo aquí pierde Trello+email del pedido
          console.error('Jobs queue error:', queueErr);
        }
      } catch (orderErr) {
        console.error('Order creation error:', orderErr);
      }
    }

    // ------------------------------------------------------------------
    // 10. Revalidate Next.js Cache Deterministically
    // ------------------------------------------------------------------
    try {
      revalidatePath(`/${tenantSlug}`);
      revalidatePath('/');
    } catch {
      // Non-blocking in dev
    }

    return {
      success: true,
      orderNumber,
      whatsappUrl,
      pdfBase64,
      // El email ahora se envía de forma asíncrona vía Jobs Queue
      emailSent: false,
      // Audit fix C4: token opaco para que el cliente descargue su nota
      pdfToken,
      pdfUrl: pdfUrlWithToken,
    };
  } catch (err: any) {
    console.error('Unhandled processOrder error:', err);
    return {
      success: false,
      error: 'Error inesperado al procesar el pedido',
    };
  }
}

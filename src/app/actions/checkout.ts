'use server';

import { generateDeliveryNotePDF } from '@/lib/pdf';
import { resolveExchangeRateVES } from '@/lib/exchange-rate';
import { uploadDeliveryNotePdf, getDeliveryNoteUrl } from '@/lib/delivery-note';
import { getPayload, type Payload } from 'payload';
import config from '@payload-config';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { Tenant, Product, Customer } from '@/payload-types';
import { sanitizePlainText } from '@/lib/order-email';
import { headers } from 'next/headers';
import { evaluateCheckoutGuards, clientIpFromHeaders } from '@/lib/checkout-guard';
import { checkTenantRateLimit } from '@/lib/rate-limit';
import { applyCustomerCrmDelta } from '@/collections/Orders';
import { randomInt } from 'crypto';
import { sql } from '@payloadcms/db-postgres/drizzle';

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
  currency: string;
  exchangeRateVES?: number;
  showVES?: boolean;
  customer: CheckoutCustomerData;
  items: CheckoutItemData[];
  // Anti-abuso Sprint 5: el nonce lo emite el storefront al renderizar y las
  // trampas de honeypot/tiempo las rellena el carrito. Sin estos campos el
  // pedido se rechaza con error genérico.
  checkoutNonce: string;
  honeypotWebsite?: string;
  formRenderedAtMs?: number;
}

export interface CheckoutResponse {
  success: boolean;
  orderNumber?: string;
  whatsappUrl?: string;
  pdfBase64?: string;
  emailSent?: boolean;
  /** URL firmada (R2) de la Nota de Entrega, válida 7 días (máx permitido por firma sigv4) */
  pdfUrl?: string;
  error?: string;
}

// R9 (plan v2): acota el tamaño máximo del pedido. Con el lookup en bloque
// (un solo find), limita también el radio de la query y evita carritos
// gigantes usados como DoS de latencia sin afectar la compra normal.
const MAX_CHECKOUT_ITEMS = 30;

/**
 * Validación runtime estricta en la frontera del Server Action
 */
function validateCheckoutInput(request: CheckoutRequest): { ok: true } | { ok: false; error: string } {
  const { tenantSlug, customer, items } = request;

  if (!tenantSlug || typeof tenantSlug !== 'string' || tenantSlug.trim().length === 0) {
    return { ok: false, error: 'Identificador de tienda inválido' };
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'El carrito está vacío' };
  }

  if (items.length > MAX_CHECKOUT_ITEMS) {
    return { ok: false, error: `Demasiados artículos en el carrito (máximo ${MAX_CHECKOUT_ITEMS}).` };
  }

  if (!customer || typeof customer !== 'object') {
    return { ok: false, error: 'Datos del cliente incompletos' };
  }

  const name = customer.name?.trim();
  const phone = customer.phone?.trim();
  const email = customer.email?.trim();

  if (!name || !phone || !email) {
    return { ok: false, error: 'Por favor completa el nombre, teléfono y correo de contacto' };
  }

  // Validación básica de formato de correo
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { ok: false, error: 'Por favor introduce un correo electrónico válido' };
  }

  return { ok: true };
}

/**
 * Verificación de precios, variantes, modificadores y stock desde la base de datos (server-side).
 * Patrón oficial adaptado de defaultProductsValidation en @payloadcms/plugin-ecommerce.
 */
async function verifyAndPriceItems({
  payload,
  tenantId,
  rawItems,
}: {
  payload: Payload;
  tenantId: number | string;
  rawItems: CheckoutItemData[];
}): Promise<{ ok: true; verifiedItems: CheckoutItemData[]; itemsSubtotal: number } | { ok: false; error: string }> {
  const skus = Array.from(new Set(rawItems.map((i) => i.sku).filter(Boolean)));
  const candidatesRes = await payload.find({
    collection: 'products',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        {
          or: [{ sku: { in: skus } }, { 'variants.sku': { in: skus } }],
        },
      ],
    },
    limit: Math.max(skus.length, 1),
    depth: 0,
    overrideAccess: true,
  });

  const baseBySku = new Map<string, Product>();
  const variantOwnerBySku = new Map<string, Product>();
  for (const doc of candidatesRes.docs as Product[]) {
    if (doc.sku && !baseBySku.has(doc.sku)) baseBySku.set(doc.sku, doc);
    for (const v of Array.isArray(doc.variants) ? doc.variants : []) {
      if (v.sku && !variantOwnerBySku.has(v.sku)) variantOwnerBySku.set(v.sku, doc);
    }
  }

  const verifiedItems: CheckoutItemData[] = [];

  for (const item of rawItems) {
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
      return { ok: false, error: 'Cantidad inválida en el carrito' };
    }

    if (!item.sku) {
      return { ok: false, error: 'Producto no disponible' };
    }

    const dbProd = baseBySku.get(item.sku) ?? variantOwnerBySku.get(item.sku);
    if (!dbProd) {
      return { ok: false, error: 'Producto no disponible en el catálogo.' };
    }

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

    let modifiersDelta = 0;
    if (item.modifiers && item.modifiers.length > 0) {
      const optionList = Array.isArray(dbProd.modifiers)
        ? dbProd.modifiers.flatMap((g) => (Array.isArray(g.options) ? g.options : []))
        : [];
      for (const optionName of item.modifiers) {
        const option = optionList.find((o) => o.name === optionName);
        if (!option) {
          return { ok: false, error: 'Opción no disponible en el catálogo.' };
        }
        modifiersDelta += Number(option.priceDelta) || 0;
      }
    }

    const finalPrice = basePrice + modifiersDelta;

    if (stockAvailable !== null && stockAvailable < qty) {
      return {
        ok: false,
        error: `Disculpe, solo quedan ${stockAvailable} unidades disponibles de "${dbProd.title}".`,
      };
    }

    verifiedItems.push({
      sku: item.sku,
      title: item.title || dbProd.title,
      quantity: qty,
      price: finalPrice,
    });
  }

  const itemsSubtotal = verifiedItems.reduce((acc, item) => acc + item.quantity * item.price, 0);
  if (itemsSubtotal <= 0) {
    return { ok: false, error: 'El total de productos del pedido es inválido' };
  }

  return { ok: true, verifiedItems, itemsSubtotal };
}

/**
 * Generador robusto de número de pedido único con control de colisiones
 */
async function generateUniqueOrderNumber(payload: Payload): Promise<string | null> {
  const now = new Date();
  for (let attempt = 0; attempt < 5; attempt++) {
    const randomSuffix = randomInt(100000, 1000000);
    const candidate = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1)
      .toString()
      .padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${randomSuffix}`;
    const clash = await payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: candidate } },
      limit: 1,
      overrideAccess: true,
    });
    if (clash.docs.length === 0) {
      return candidate;
    }
  }
  return null;
}

/**
 * Construcción y sanitización del mensaje de WhatsApp estructurado
 */
function buildWhatsappMessagePayload({
  tenantDoc,
  storeName,
  orderNumber,
  customer,
  verifiedItems,
  deliveryFee,
  total,
  totalVES,
  vesRate,
  showVESEffective,
  pdfUrl,
}: {
  tenantDoc: Tenant;
  storeName?: string;
  orderNumber: string;
  customer: CheckoutCustomerData;
  verifiedItems: CheckoutItemData[];
  deliveryFee: number;
  total: number;
  totalVES: number;
  vesRate: number | null;
  showVESEffective: boolean;
  pdfUrl?: string;
}): { whatsappUrl: string; safePhone: string; safeEmail: string } {
  const targetPhone = tenantDoc.whatsappPhone || '';
  const cleanTargetPhone = targetPhone.replace(/\D/g, '');

  const itemsSummary = verifiedItems
    .map((item) => `• ${item.quantity}x ${sanitizePlainText(item.title)} ($${(item.quantity * item.price).toFixed(2)})`)
    .join('\n');

  const rawPaymentLabel = customer.paymentDetails?.methodKey
    ? customer.paymentDetails.methodKey.replace('_', ' ').toUpperCase()
    : customer.paymentMethod || 'PAGO ELECTRÓNICO';
  const paymentLabel = sanitizePlainText(rawPaymentLabel);

  const safeName = sanitizePlainText(customer.name);
  const cleanedPhone = customer.phone.trim().replace(/[^\d+\s-]/g, '');
  const safePhone = cleanedPhone.length > 0 ? cleanedPhone : sanitizePlainText(customer.phone.trim());
  const rawEmail = customer.email ? customer.email.trim().toLowerCase() : '';
  const safeEmail = sanitizePlainText(rawEmail);
  const safeNotes = sanitizePlainText(customer.notes);
  const safeAddress = sanitizePlainText(customer.address);
  const safeBuilding = sanitizePlainText(customer.deliveryDetails?.buildingHouse);
  const safeMunicipality = sanitizePlainText(customer.deliveryDetails?.municipality);
  const safeReference = sanitizePlainText(customer.paymentDetails?.referenceNumber);

  const whatsappMessage = `👋 *¡Nuevo Pedido #${orderNumber}!*
🏪 *Comercio:* ${tenantDoc?.name || storeName}

👤 *Cliente:* ${safeName}
📱 *Teléfono:* ${safePhone}
${safeEmail ? `📧 *Correo:* ${safeEmail}\n` : ''}🛵 *Modalidad:* ${customer.deliveryType === 'pickup' ? 'Retiro en Tienda (Pickup)' : 'Delivery'}
${safeAddress ? `📍 *Dirección:* ${safeAddress}\n` : ''}${safeBuilding ? `🏢 *Edif/Casa:* ${safeBuilding}\n` : ''}${safeMunicipality ? `🗺️ *Municipio:* ${safeMunicipality}\n` : ''}💳 *Método de Pago:* ${paymentLabel}
${safeReference ? `🔢 *N° Referencia:* ${safeReference}\n` : ''}${safeNotes ? `📝 *Nota:* ${safeNotes}\n` : ''}
🛒 *Productos:*
${itemsSummary}
${deliveryFee > 0 ? `\n🛵 *Tarifa Delivery:* $${deliveryFee.toFixed(2)} USD` : ''}
💰 *TOTAL A PAGAR:*
💵 *$${total.toFixed(2)} USD*
${showVESEffective ? `🇻🇪 *Bs. ${totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}* (Tasa: ${(vesRate ?? 0).toFixed(2)} Bs/$)\n` : ''}
📄 ${pdfUrl ? `*Nota de Entrega PDF:* ${pdfUrl}` : '_He generado mi Nota de Entrega en PDF. Por favor confirma la recepción._'}`;

  const whatsappUrl = `https://wa.me/${cleanTargetPhone.startsWith('58') ? cleanTargetPhone : `58${cleanTargetPhone}`}?text=${encodeURIComponent(
    whatsappMessage
  )}`;

  return { whatsappUrl, safePhone, safeEmail };
}

/**
 * Upsert atómico de cliente en CRM con PostgreSQL SQL vía Drizzle (cero MongoDB shims).
 * Evita condiciones de carrera read-modify-write y garantiza persistencia transaccional.
 */
async function upsertCustomerCrm({
  payload,
  tenantId,
  customer,
  safePhone,
  safeEmail,
  total,
  now,
  orderDoc,
  verifiedItems,
}: {
  payload: Payload;
  tenantId: number;
  customer: CheckoutCustomerData;
  safePhone: string;
  safeEmail: string;
  total: number;
  now: Date;
  orderDoc: { id: number | string };
  verifiedItems: CheckoutItemData[];
}): Promise<void> {
  // Contrato (review Graphify #65): los errores DEBEN llegar al boundary de
  // checkout (donde están orderDoc.id y orderNumber) para el log estructurado.
  // Este wrapper NO traga errores — el caller decide si es best-effort.
  // Preserva best-effort checkout: el pedido se registra aunque el CRM falle.
  const cleanPhone = safePhone.trim();

    const findCustomerByTenantPhone = () =>
      payload.find({
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

    const applyOrderToCustomerSql = async (cust: Customer): Promise<void> => {
      const adapter = payload.db as unknown as {
        drizzle: { execute: (query: unknown) => Promise<unknown> };
        tableNameMap?: Map<string, string>;
      };
      const tableName = adapter.tableNameMap?.get?.('customers') || 'customers';

      const res = (await adapter.drizzle.execute(sql`
        update ${sql.identifier(tableName)}
        set name = coalesce(${customer.name || null}, name),
            email = coalesce(${safeEmail || null}, email),
            last_order_at = ${now.toISOString()},
            total_orders = coalesce(total_orders, 0) + 1,
            total_spent = coalesce(total_spent, 0) + ${total}
        where id = ${cust.id}
        returning total_orders, total_spent, tag
      `)) as { rows?: Array<{ total_orders?: number; total_spent?: number; tag?: string }> };

      const updatedRow = res?.rows?.[0];
      const ordersCount = Number(updatedRow?.total_orders) || 0;
      const spentTotal = Number(updatedRow?.total_spent) || 0;
      const nextTag = ordersCount >= 3 || spentTotal >= 50 ? 'vip' : 'frecuente';

      if (updatedRow && updatedRow.tag !== nextTag) {
        await payload.update({
          collection: 'customers',
          id: cust.id,
          overrideAccess: true,
          data: { tag: nextTag },
        });
      }
    };

    const existingCust = (await findCustomerByTenantPhone()).docs[0] as Customer | undefined;

    // Preparar datos del historial y preferencias
    const itemsSummary = verifiedItems
      .map((item) => `${item.quantity}x ${item.title}`)
      .join(', ');
    
    const purchaseHistoryEntry = {
      orderId: Number(orderDoc.id),
      amount: total,
      date: now.toISOString().split('T')[0], // YYYY-MM-DD
      itemsSummary,
      deliveryType: (customer.deliveryType === 'pickup' ? 'pickup' : 'delivery') as 'delivery' | 'pickup',
    };

    const updatePreferences = {
      preferredPaymentMethod: customer.paymentDetails?.methodKey || customer.paymentMethod || null,
      preferredDeliveryType: (customer.deliveryType === 'delivery' || customer.deliveryType === 'pickup'
        ? customer.deliveryType
        : 'none') as 'delivery' | 'pickup' | 'none',
    };

    if (existingCust) {
      await applyOrderToCustomerSql(existingCust);
      
      // Actualizar historial y preferencias vía Payload API
      const currentHistory = (Array.isArray(existingCust.purchaseHistory) ? existingCust.purchaseHistory : [])
        .map((entry) => ({
          orderId: typeof entry.orderId === 'object' && entry.orderId !== null ? entry.orderId.id : (entry.orderId ? Number(entry.orderId) : null),
          amount: entry.amount,
          date: entry.date,
          itemsSummary: entry.itemsSummary,
          deliveryType: entry.deliveryType,
          id: entry.id,
        }));
      const updatedHistory = [purchaseHistoryEntry, ...currentHistory].slice(0, 50); // Mantener últimos 50
      
      const currentPrefs = existingCust.preferences || {};
      const mergedPrefs = { ...currentPrefs, ...updatePreferences };
      
      // Calcular nuevo valor promedio
      const newTotalSpent = (Number(existingCust.totalSpent) || 0) + total;
      const newTotalOrders = (Number(existingCust.totalOrders) || 0) + 1;
      const newAvgOrderValue = newTotalOrders > 0 ? newTotalSpent / newTotalOrders : 0;

      await payload.update({
        collection: 'customers',
        id: existingCust.id,
        overrideAccess: true,
        data: {
          purchaseHistory: updatedHistory,
          preferences: {
            ...mergedPrefs,
            averageOrderValue: newAvgOrderValue,
          },
        },
      });
    } else {
      try {
        await payload.create({
          collection: 'customers',
          overrideAccess: true,
          data: {
            name: customer.name,
            phone: cleanPhone,
            email: safeEmail || '',
            tenant: tenantId,
            totalOrders: 1,
            totalSpent: total,
            tag: 'nuevo',
            lastOrderAt: now.toISOString(),
            purchaseHistory: [purchaseHistoryEntry],
            preferences: {
              ...updatePreferences,
              averageOrderValue: total,
            },
          },
        });
      } catch (createErr) {
        // Carrera concurrente: índice único compuesto customers_tenant_phone_unique
        const winner = (await findCustomerByTenantPhone()).docs[0] as Customer | undefined;
        if (!winner) throw createErr;
        await applyOrderToCustomerSql(winner);
      }
    }
}

export async function processOrder(request: CheckoutRequest): Promise<CheckoutResponse> {
  try {
    const { tenantSlug, storeName, currency, showVES, customer, items } = request;

    // ------------------------------------------------------------------
    // 0. Anti-abuso (Sprint 5): nonce → honeypot → rate-limit por IP
    // ------------------------------------------------------------------
    const hdrs = await headers();
    const guard = await evaluateCheckoutGuards({
      tenantSlug,
      nonce: request.checkoutNonce,
      honeypotWebsite: request.honeypotWebsite,
      formRenderedAtMs: request.formRenderedAtMs,
      clientIp: clientIpFromHeaders(hdrs),
    });
    if (!guard.ok) {
      return { success: false, error: guard.error };
    }

    // ------------------------------------------------------------------
    // 1. Boundary Input Validation (Zod-like schema enforcement)
    // ------------------------------------------------------------------
    const validation = validateCheckoutInput(request);
    if (!validation.ok) {
      return { success: false, error: validation.error };
    }

    // ------------------------------------------------------------------
    // 2. Fetch Tenant (Official Pattern)
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

    if (!tenantId || !tenantDoc) {
      return { success: false, error: 'Tienda no encontrada' };
    }

    if (!tenantDoc.whatsappPhone) {
      return { success: false, error: 'Esta tienda no está configurada para recibir pedidos.' };
    }

    // Auditoría final 2026-09-01 (P1): segunda capa anti-abuso POR TENANT
    // (50/min, ya definida en lib/rate-limit.ts pero nunca cableada). El
    // rate-limit por IP+tenant no detiene un ataque distribuido (botnet con
    // miles de IPs) contra UNA tienda; este contador compartido sí.
    const tenantRl = await checkTenantRateLimit(tenantId, 'checkout');
    if (!tenantRl.allowed) {
      return {
        success: false,
        error: 'La tienda está recibiendo demasiados pedidos ahora mismo. Inténtalo de nuevo en un minuto.',
      };
    }

    // ------------------------------------------------------------------
    // 3. Server-Side Price & Stock Verification (Fraud Prevention)
    // ------------------------------------------------------------------
    const verifyResult = await verifyAndPriceItems({
      payload,
      tenantId,
      rawItems: items,
    });

    if (!verifyResult.ok) {
      return { success: false, error: verifyResult.error };
    }

    const { verifiedItems, itemsSubtotal } = verifyResult;

    // Tarifa fija de delivery configurada por el comercio en Payload
    const deliveryFee =
      customer.deliveryType === 'delivery'
        ? Number(tenantDoc.deliveryConfig?.fixedPrice || 0)
        : 0;

    const total = itemsSubtotal + deliveryFee;

    // ------------------------------------------------------------------
    // 4. Resolve Exchange Rate & Generate Order Number
    // ------------------------------------------------------------------
    const { rate: vesRate } = await resolveExchangeRateVES(tenantDoc);
    const showVESEffective = showVES === false ? false : vesRate !== null;
    const totalVES = vesRate ? total * vesRate : 0;

    const orderNumber = await generateUniqueOrderNumber(payload);
    if (!orderNumber) {
      return { success: false, error: 'No se pudo generar un número de pedido único. Intenta de nuevo.' };
    }

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // ------------------------------------------------------------------
    // 5. Generate Official Delivery Note PDF & Upload to R2
    // ------------------------------------------------------------------
    let pdfBase64: string | undefined = undefined;
    let pdfUrl: string | undefined = undefined;
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
        deliveryType: customer.deliveryType,
        deliveryFee,
        subtotal: itemsSubtotal,
        total,
        totalVES,
        exchangeRateVES: vesRate ?? 0,
        showVES: showVESEffective,
        items: verifiedItems,
      });
      pdfBase64 = Buffer.from(pdfBytes).toString('base64');

      const uploaded = await uploadDeliveryNotePdf(orderNumber, pdfBytes);
      if (uploaded) {
        pdfUrl = (await getDeliveryNoteUrl(orderNumber)) ?? undefined;
      }
    } catch (pdfErr) {
      console.warn('PDF generation warning:', pdfErr);
    }

    // ------------------------------------------------------------------
    // 6. Build Structured WhatsApp Message & Sanitize Customer Data
    // ------------------------------------------------------------------
    const { whatsappUrl, safePhone, safeEmail } = buildWhatsappMessagePayload({
      tenantDoc,
      storeName,
      orderNumber,
      customer,
      verifiedItems,
      deliveryFee,
      total,
      totalVES,
      vesRate,
      showVESEffective,
      pdfUrl,
    });

    // ------------------------------------------------------------------
    // 7. Persist Order in Orders Collection & Enqueue Async Job
    // ------------------------------------------------------------------
    try {
      const orderDoc = await payload.create({
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
            phone: safePhone || customer.phone,
            email: safeEmail || '',
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
          exchangeRateVES: vesRate ?? undefined,
        },
      });

      // ------------------------------------------------------------------
      // 8. Upsert Customer in CRM Collection (best-effort) + marcar crmCounted
      // ------------------------------------------------------------------
      // Review Graphify/Devin #67: crmCounted refleja un incremento CRM
      // REALMENTE committeado. Se setea DESPUÉS de que upsertCustomerCrm fue
      // exitoso — nunca durante la creación de la orden. Si el CRM falla, la
      // flag queda false → la cancelación NO resta (no se resta un incremento
      // que nunca pasó). Si el CRM succeed pero el update de la flag falla,
      // se loguea para reconciliación (el incremento es real, la flag no lo
      // refleja → inflación en cancel; caso raro, no bloquea el checkout).
      let crmUpsertSucceeded = false;
      try {
        await upsertCustomerCrm({
          payload,
          tenantId,
          customer,
          safePhone,
          safeEmail,
          total,
          now,
          orderDoc: { id: orderDoc.id as number },
          verifiedItems,
        });
        crmUpsertSucceeded = true;
      } catch (crmErr) {
        // CRM upsert falló → la flag crmCounted queda false (default) →
        // la cancelación NO restará un incremento que nunca existió.
        console.error(
          `[storelink][crm][checkout] CRM upsert falló para orden ${orderDoc.id} (orderNumber ${orderNumber}); pedido registrado y en despacho. Reconciliar CRM desde esta orden.`,
          crmErr
        );
      }

      if (crmUpsertSucceeded) {
        try {
          await payload.update({
            collection: 'orders',
            id: orderDoc.id as number,
            overrideAccess: true,
            context: { skipInventoryHook: true },
            data: { crmCounted: true } as never,
          });

          // Race check (review Devin #67): la orden pudo haber sido cancelada
          // entre su creación y este punto. Si ya está cancelada, aplicar el
          // decremento AHORA (el hook no lo hará porque crmCounted era false
          // cuando la cancelación ocurrió).
          const currentOrder = await payload.findByID({
            collection: 'orders',
            id: orderDoc.id as number,
            overrideAccess: true,
          });
          if ((currentOrder as { status?: string }).status === 'cancelled') {
            await applyCustomerCrmDelta({
              payload,
              tenantId,
              phone: safePhone,
              totalAmount: total,
              sign: -1,
            });
          }
        } catch (flagErr) {
          // Opposite partial failure: CRM increment committeó pero la flag no
          // se pudo actualizar. El incremento es real; si la orden se cancela
          // después, no se restará (flag false) → inflación en el CRM.
          // Se loguea para reconciliación manual. No bloquea el checkout.
          console.error(
            `[storelink][crm][checkout] CRM increment OK pero crmCounted flag update falló para orden ${orderDoc.id} (orderNumber ${orderNumber}). Reconciliar: setear crmCounted=true.`,
            flagErr
          );
        }
      }

      // Despacho asíncrono vía Jobs Queue oficial
      try {
        const job = await payload.jobs.queue({
          workflow: 'order-created',
          input: { orderId: orderDoc.id as number },
        });

        after(async () => {
          try {
            await payload.jobs.runByID({ id: job.id });
          } catch (runErr) {
            console.error('Jobs run error (quedará en cola para el runner externo):', runErr);
          }
        });
      } catch (queueErr) {
        console.error('Jobs queue error:', queueErr);
      }
    } catch (orderErr) {
      console.error('Order creation error:', orderErr);
      // Propagar únicamente mensajes controlados de inventario ("Stock insuficiente para [Producto]")
      // No exponer raw APIError ni detalles internos de backend a usuarios no autenticados (review Devin #69)
      if (orderErr instanceof Error && orderErr.message.includes('Stock insuficiente')) {
        return {
          success: false,
          error: orderErr.message,
        };
      }
      return {
        success: false,
        error: 'No se pudo registrar tu pedido. Por favor inténtalo de nuevo.',
      };
    }

    // ------------------------------------------------------------------
    // 9. Revalidate Next.js Cache — solo el storefront del tenant activo.
    // Sprint 3: revalidatePath('/') eliminado — con 20+ comercios activos
    // invalidar la root en cada venta forzaba rerender de todos los storefronts.
    // ------------------------------------------------------------------
    try {
      revalidatePath(`/${tenantSlug}`);
    } catch {
      // Non-blocking in dev
    }

    return {
      success: true,
      orderNumber,
      whatsappUrl,
      pdfBase64,
      pdfUrl,
      emailSent: false,
    };
  } catch (err: unknown) {
    console.error('Unhandled processOrder error:', err);
    return {
      success: false,
      error: 'Error inesperado al procesar el pedido',
    };
  }
}

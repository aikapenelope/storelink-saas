'use server';

import { generateDeliveryNotePDF } from '@/lib/pdf';
import { resolveExchangeRateVES } from '@/lib/exchange-rate';
import { uploadDeliveryNotePdf, getDeliveryNoteUrl } from '@/lib/delivery-note';
import { getPayload, type Payload } from 'payload';
import config from '@payload-config';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { Tenant, Customer } from '@/payload-types';
import { loadProductIndexBySku } from '@/lib/product-index';
import { sanitizePlainText } from '@/lib/order-email';
import { headers } from 'next/headers';
import { evaluateCheckoutGuards, clientIpFromHeaders } from '@/lib/checkout-guard';
import { checkTenantRateLimit } from '@/lib/rate-limit';
// paymentDetails se normaliza en 0bis con normalizePaymentDetails (whitelist
// de claves + force de paymentStatus). Las validaciones de enums de
// deliveryType/methodKey/currency viven ahora en el boundary extraído
// (src/lib/checkout-validation.ts) junto al resto de whitelists fail-fast.
import { normalizePaymentDetails } from '@/lib/checkout-sanitize';
import {
  buildIdempotencyKey,
  releaseCheckoutReservation,
  storeCheckoutResponse,
  tryReserveCheckout,
  waitForCheckoutResponse,
} from '@/lib/checkout-idempotency';
import { buildCheckoutProcessingResponse } from '@/lib/checkout-response';
import { applyCustomerCrmDelta, claimOrderCrmCounted } from '@/collections/Orders';
import { randomInt } from 'crypto';
import { sql } from '@payloadcms/db-postgres/drizzle';
// PR 4.3 + flags Devin #116 r3: tipos y boundary de validación extraídos a
// src/lib/checkout-validation.ts — normalizan el texto del comprador UNA vez
// (cierra «Whitespace bypasses boundary text caps») y reconstruyen la
// dirección de pickup server-side (cierra «Pickup configuration blocks
// valid checkout»). La Server Action sigue siendo el orquestador.
import {
  buildPickupAddress,
  normalizeCheckoutCustomer,
  validateCheckoutInput,
  type CheckoutCustomerData,
  type CheckoutItemData,
  type CheckoutRequest,
} from '@/lib/checkout-validation';

export interface CheckoutResponse {
  success: boolean;
  orderNumber?: string;
  whatsappUrl?: string;
  pdfBase64?: string;
  emailSent?: boolean;
  /** URL firmada (R2) de la Nota de Entrega, válida 7 días (máx permitido por firma sigv4) */
  pdfUrl?: string;
  // Auditoría 2026-09-04 (P1 parcial): totales confirmados por el SERVIDOR.
  // La tasa embebida en el HTML ISR puede diferir de la resuelta en vivo al
  // momentar del checkout (ventana de hasta 300s); el drawer muestra estos
  // valores en la pantalla de éxito como referencia oficial del pedido.
  totalUSD?: number;
  totalVES?: number;
  exchangeRateVES?: number;
  error?: string;
  /**
   * Review Devin #74 ("Slow retries create duplicate orders"): true SOLO en
   * el resultado "en proceso" — un request duplicado agotó la espera de la
   * respuesta del dueño, pero el dueño puede seguir procesando (PDF, R2,
   * CRM, Trello). NO es un fallo definitivo: el carrito PRESERVA el token de
   * intención para que el reintento se adhiere a la reserva existente.
   * Ausente (undefined) en éxitos y en fallos definitivos.
   */
  processing?: boolean;
}

// R9 (plan v2): acota el tamaño máximo del pedido. Con el lookup en bloque
// (un solo find), limita también el radio de la query y evita carritos
// gigantes usados como DoS de latencia sin afectar la compra normal.
// Única fuente canónica: src/lib/constants.ts (antes estaba duplicado aquí).

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
  // PR 10 (thermo D1): el índice SKU→producto vive en el helper compartido
  // src/lib/product-index.ts (misma query batch + first-wins + fallback que
  // el hook de Orders) — el cobro del checkout y la deducción de stock ya no
  // pueden divergir por copias desincronizadas.
  const { baseBySku, variantOwnerBySku } = await loadProductIndexBySku({
    payload,
    tenantId,
    skus,
  });

  const verifiedItems: CheckoutItemData[] = [];

  // Auditoría 2026-09-04 (P2): validar el stock contra la cantidad AGREGADA
  // por SKU, no por línea. El carrito puede generar dos líneas del mismo SKU
  // (mismo producto con distintos modificadores): validar por línea dejaba
  // pasar un pedido cuya suma excedía el stock, que luego fallaba completa en
  // el hook de inventario (falso "sin stock" tras todo el formulario).
  const qtyBySku = new Map<string, number>();
  for (const item of rawItems) {
    if (!item.sku) continue;
    qtyBySku.set(item.sku, (qtyBySku.get(item.sku) || 0) + (Number(item.quantity) || 0));
  }

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

    // Auditoría 2026-09-04 (P2): respetar el estado manual del comerciante.
    // Un producto marcado "Agotado" era comprable si trackStock estaba apagado
    // o le quedaba stock residual: el checkout solo miraba la cantidad.
    if (dbProd.stockStatus === 'out_of_stock') {
      return { ok: false, error: `Disculpe, "${dbProd.title}" está agotado.` };
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
      if (matchedVariant.stockStatus === 'out_of_stock') {
        return {
          ok: false,
          error: `Disculpe, "${matchedVariant.name || dbProd.title}" está agotado.`,
        };
      }
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

    if (stockAvailable !== null) {
      const totalQtyForSku = qtyBySku.get(item.sku) || qty;
      if (stockAvailable < totalQtyForSku) {
        return {
          ok: false,
          error: `Disculpe, solo quedan ${stockAvailable} unidades disponibles de "${dbProd.title}".`,
        };
      }
    }

    // Auditoría 2026-09-07 (A2): título server-authoritative. El título que
    // envía el cliente se descarta — el nombre sale de la BD (producto base o
    // variante) y los modificadores (ya validados contra el catálogo) se
    // anexan al final, porque `modifiers` NO se persiste en la orden
    // (solo sku/title/price/quantity/subtotal): sin anexarlos se perdería la
    // personalización del pedido para el comercio (PDF/WhatsApp/CRM).
    const serverTitle = matchedVariant?.name
      ? `${dbProd.title} - ${matchedVariant.name}`
      : dbProd.title;
    const itemTitle = item.modifiers?.length
      ? `${serverTitle} (${item.modifiers.join(', ')})`
      : serverTitle;

    verifiedItems.push({
      sku: item.sku,
      title: itemTitle,
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
  // Auditoría 2026-09-04 (P3): YYMMDD en America/Caracas — getFullYear()/
  // getMonth()/getDate() usaban la TZ del proceso (UTC en Vercel), así que
  // los pedidos entre 20:00 y 24:00 Caracas salían con fecha del día siguiente.
  const caracasDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()); // "YY-MM-DD"
  const datePrefix = caracasDate.split('-').join(''); // YYMMDD, formato original
  for (let attempt = 0; attempt < 5; attempt++) {
    const randomSuffix = randomInt(100000, 1000000);
    const candidate = `${datePrefix}-${randomSuffix}`;
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
  safePhone,
  safeEmail,
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
  /** PR 4: sanitización calculada ANTES del create (la orden la persiste). */
  safePhone: string;
  safeEmail: string;
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
  // PR 4: safePhone/safeEmail llegan como parámetros (calculados en
  // processOrder ANTES del create — la orden los persiste). Misma
  // normalización, única fuente.
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

    const applyOrderToCustomerSql = async (
      cust: Customer,
    ): Promise<{ totalOrders: number; totalSpent: number } | null> => {
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

      // PR 13 (thermo D4): los totales del RETURNING son la fuente de verdad
      // post-delta atómico — el caller evita recalcular en JS leyendo el doc
      // VIEJO (deriva bajo checkouts concurrentes del mismo cliente).
      return updatedRow ? { totalOrders: ordersCount, totalSpent: spentTotal } : null;
    };

    const existingCust = (await findCustomerByTenantPhone()).docs[0] as Customer | undefined;

    // Preparar datos del historial y preferencias
    // Auditoría 2026-09-07 (A2): el resumen hacia el CRM se sanitiza (sin
    // saltos de línea ni caracteres de control) aunque los títulos ya sean
    // server-authoritative.
    const itemsSummary = verifiedItems
      .map((item) => sanitizePlainText(`${item.quantity}x ${item.title}`))
      .filter(Boolean)
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
      const crmTotals = await applyOrderToCustomerSql(existingCust);

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

      // PR 13 (thermo D4): averageOrderValue desde el RETURNING del SQL
      // atómico (fuente de verdad post-delta) — antes se recalculaba en JS
      // sumando `total` al doc VIEJO, que deriva bajo checkouts concurrentes
      // del mismo cliente (dos pedidos leían el mismo totalSpent y el promedio
      // quedaba atrás). Fallback al cálculo local solo si el RETURNING no
      // llegó (fila no actualizada — no debería ocurrir).
      const newTotalOrders = crmTotals?.totalOrders ?? (Number(existingCust.totalOrders) || 0) + 1;
      const newTotalSpent = crmTotals?.totalSpent ?? (Number(existingCust.totalSpent) || 0) + total;
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

/**
 * PR 13 (SPEC-20260907-13, thermo D4): sección 9 del checkout (secciones
 * 7bis+8 de la spec original tras el reorden del PR #94) extraída a helper
 * con params explícitos: CRM upsert best-effort + claim transaccional de
 * crmCounted (con compensación de cancelación) + encolado del despacho vía
 * Jobs Queue. La función processOrder queda como orquestador legible; el
 * bloque preserva EXACTAMENTE la semántica revisada por Devin (#67, #92,
 * #74) — ver comentarios internos.
 *
 * Nada de esto bloquea el pedido: el admin del checkout ya fue creado y la
 * respuesta de replay persistida por el caller ANTES de esta llamada.
 */
async function finalizeOrderCrmAndDispatch({
  payload,
  tenantId,
  orderDoc,
  orderNumber,
  customer,
  safePhone,
  safeEmail,
  total,
  verifiedItems,
  now,
  customerShowVES,
}: {
  payload: Payload;
  tenantId: number;
  orderDoc: { id: number };
  orderNumber: string;
  customer: CheckoutCustomerData;
  safePhone: string;
  safeEmail: string;
  total: number;
  verifiedItems: CheckoutItemData[];
  now: Date;
  customerShowVES?: boolean;
}): Promise<void> {
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
      orderDoc,
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
    // Review Devin PR #92 ("Lost pre-claim cancellation adjustment"): el
    // claim y la compensación comparten UNA transacción explícita (API
    // oficial beginTransaction/commit/rollback). Si la compensación falla,
    // el rollback deja crm_counted en false → el reintento del comprador
    // puede reclamar de nuevo y completar el ajuste exactamente una vez.
    // Sin la compensación (status != cancelled) el claim es autocommit y
    // best-effort como siempre: nunca bloquea el pedido.
    const mustCompensate = await (async () => {
      // beginTransaction puede devolver null (transacciones deshabilitadas
      // en el adapter): en ese caso se degrada al claim autocommit aislado
      // (best-effort documentado) — sin compensación atómica, pero el
      // pedido nunca se bloquea.
      const txId = await payload.db.beginTransaction();
      if (txId === null) {
        const { claimed, status } = await claimOrderCrmCounted({
          payload,
          orderId: orderDoc.id,
        });
        if (claimed && status === 'cancelled') {
          await applyCustomerCrmDelta({
            payload,
            tenantId,
            phone: safePhone,
            totalAmount: total,
            sign: -1,
          });
          return true;
        }
        return false;
      }
      try {
        const req = { transactionID: txId };
        const { claimed, status } = await claimOrderCrmCounted({
          payload,
          orderId: orderDoc.id,
          req,
        });
        if (claimed && status === 'cancelled') {
          await applyCustomerCrmDelta({
            payload,
            tenantId,
            phone: safePhone,
            totalAmount: total,
            sign: -1,
            req,
          });
        }
        await payload.db.commitTransaction(txId);
        return claimed && status === 'cancelled';
      } catch (txErr) {
        try {
          await payload.db.rollbackTransaction(txId);
        } catch {
          // El rollback falló (conexión muerta): la sesión se cae sola.
        }
        throw txErr;
      }
    })().catch((flagErr: unknown) => {
      // Opposite partial failure: CRM increment committeó pero la pareja
      // claim+compensación no pudo completarse (ambos revertidos). La flag
      // quedó false → si la orden se cancela después, el hook no restará
      // → inflación pendiente. Se loguea para reconciliación manual. No
      // bloquea el checkout: el pedido ya existe.
      console.error(
        `[storelink][crm][checkout] CRM increment OK pero la transacción claim+compensación falló para orden ${orderDoc.id} (orderNumber ${orderNumber}). Reconciliar: setear crmCounted=true.`,
        flagErr
      );
      return false;
    });
    // `mustCompensate` solo informa al log: la compensación ya ocurrió
    // dentro de la tx o el flujo se degradó a best-effort documentado.
    void mustCompensate;
  }

  // Despacho asíncrono vía Jobs Queue oficial
  try {
    const job = await payload.jobs.queue({
      workflow: 'order-created',
      input: {
        orderId: orderDoc.id,
        customerShowVES,
      },
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
}

export async function processOrder(request: CheckoutRequest): Promise<CheckoutResponse> {
  // Declarados al tope de la función para que el catch externo pueda liberar
  // la reserva sin TDZ aunque el fallo ocurra antes de la sección 3bis
  // (review Devin #74: toda salida fallida antes de crear la orden libera).
  let idempotencyKey: string | null = null;
  let orderCreated = false;
  // Review Devin #74 (2ª ronda): se construye y persiste en la frontera de
  // creación de la orden (7bis); el final de processOrder solo la retorna.
  let successResponse: CheckoutResponse | null = null;
  try {
    // PR 4.3 (H-4): `currency` del request se IGNORA deliberadamente — la
    // etiqueta de moneda vive en tenant.branding.currency (anclada arriba).
    const { tenantSlug, storeName, showVES, items } = request;

    // ------------------------------------------------------------------
    // 0bis. Normalización del comprador (Auditoría 2026-09-07, A1 +
    // flag Devin #116 r3 «Whitespace bypasses boundary text caps»)
    // ------------------------------------------------------------------
    // El comprador anónimo es un writer NO confiable: `paymentStatus` se
    // fuerza a 'pending_verification' y el resto de paymentDetails pasa por
    // whitelist de claves. La fuerza vive aquí y NO en hooks de colección
    // porque el admin panel comparte la colección y ahí el comercio SÍ puede
    // marcar 'verified' legítimamente al conciliar el pago.
    //
    // Además, TODO el texto del comprador se normaliza UNA vez aquí
    // (normalizeCheckoutCustomer: trim — la cota NO trunca, el boundary
    // rechaza el exceso con mensaje visible): esta copia es la que consumen
    // idempotencia, payload.create, PDF, WhatsApp y CRM. Antes el boundary
    // medía trim().length pero la orden persistía el string SIN trim →
    // "Casa 4" + 10k espacios pasaba el boundary y Payload lo rechazaba
    // tras pricing/tasa (flag Devin #116 r3). Ahora la cota mide
    // EXACTAMENTE lo que se persiste.
    const customer: CheckoutCustomerData = normalizeCheckoutCustomer({
      ...request.customer,
      paymentDetails: normalizePaymentDetails(request.customer?.paymentDetails),
    });

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
    // Recibe el customer NORMALIZADO (0bis): las cotas de
    // validateCheckoutInput miden la MISMA string que se persistirá, sin
    // bypass por whitespace. La implementación vive en
    // src/lib/checkout-validation.ts (extraída para testearla sin levantar
    // la Server Action): shape del carrito, cota MAX_CHECKOUT_ITEMS
    // (única fuente: src/lib/constants.ts), whitelists de enums y cotas
    // de texto — en ese orden (flag Devin #116 r4).
    const validation = validateCheckoutInput({ ...request, customer, items });
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

    // ------------------------------------------------------------------
    // 2bis. Dirección de pickup RECONSTRUIDA server-side (flag Devin #116
    // r3: «Pickup configuration blocks valid checkout»)
    // ------------------------------------------------------------------
    // Antes el drawer armaba la dirección pickup desde pickupConfig del
    // tenant (locationAddress/schedule SIN cotas) y el boundary la validaba
    // contra maxLength 600: una config larga del comercio bloqueaba TODOS
    // sus checkouts pickup aunque el comprador no ingresara dirección — y
    // además dejaba al comprador ESPECIFICAR la "dirección" de retiro
    // (spoofeable). Ahora el servidor la construye desde tenantDoc (fuente
    // confiable, con defaults si la config falta — mismo texto que el drawer
    // mostraba) y el `address` del request se ignora por completo en pickup.
    // En delivery el `address` del comprador (ya normalizado y acotado en
    // 0bis/1) se conserva tal cual.
    if (customer.deliveryType === 'pickup') {
      customer.address = buildPickupAddress(
        { name: tenantDoc.name },
        tenantDoc.pickupConfig as { locationAddress?: string | null; schedule?: string | null } | undefined,
      );
    }

    // PR 4.3 (plan sprints 2026-09-09, H-4/H-5): anclajes al tenant. Los
    // montos SIEMPRE se calcularon server-side en USD; pero las ETIQUETAS
    // (currency) y el toggle Bs. venían del request del comprador — un
    // writer no confiable podía etiquetar 'EUR' una orden cobrada en USD o
    // forzar la línea Bs. en un comercio que la deshabilitó. Ahora:
    //  - currency: se ancla a 'USD', el valor con el que de VERDAD se
    //    calculan y muestran los montos (storefront/PDF/Trello usan `$` y
    //    'USD'). branding.currency (enum USD/EUR/MXN/COP) NO está cableado a
    //    montos ni al storefront, así que etiquetar con él produciría
    //    órdenes "EUR" con montos en USD (review Devin #116, «Non-USD
    //    checkouts show conflicting currencies»). El request del comprador
    //    se ignora; el enum queda para cuando exista conversión real.
    //  - showVES: el tenant decide (branding.showVES !== false); el cliente
    //    solo puede APAGAR la línea Bs. de su propia respuesta si la tasa
    //    no aplica, nunca encenderla contra la voluntad del comercio.
    const tenantShowVES = tenantDoc.branding?.showVES !== false;

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

    // ------------------------------------------------------------------
    // 3bis. Idempotencia (auditoría 2026-09-04, P1-2): el nonce NO es
    // single-use, así que un doble clic / reenvío / reintento del navegador
    // creaba dos órdenes idénticas (stock doble, dos WhatsApp, doble CRM).
    // La clave reserva el pedido en Upstash: el duplicado recibe la respuesta
    // del primero. Fail-open si Redis no está disponible (misma decisión de
    // disponibilidad documentada en rate-limit.ts).
    //
    // Review Devin #74: la clave incluye (a) un token de intención generado
    // por el carrito — un reintento de transporte reenvía el MISMO body con el
    // MISMO token y recibe la respuesta del dueño, pero una compra nueva
    // intencional genera otro token y crea su propia orden — y (b) dirección y
    // método de pago, que también definen el pedido. Token inválido → se
    // ignora (retrocompatible con clientes sin token).
    // Declaradas al tope de la función (catch externo las referencia sin TDZ).
    const attemptToken =
      typeof request.idempotencyToken === 'string' &&
      /^[A-Za-z0-9_-]{8,64}$/.test(request.idempotencyToken.trim())
        ? request.idempotencyToken.trim()
        : null;
    idempotencyKey = buildIdempotencyKey({
      tenantId,
      items,
      customerPhone: customer.phone,
      customerEmail: customer.email ?? '',
      deliveryType: customer.deliveryType,
      municipality: customer.deliveryDetails?.municipality,
      customerAddress: customer.address ?? '',
      paymentMethod: customer.paymentMethod ?? '',
      attemptToken,
    });
    const reserved = await tryReserveCheckout(idempotencyKey);
    if (!reserved) {
      const duplicateResponse = await waitForCheckoutResponse(idempotencyKey);
      if (duplicateResponse) {
        return duplicateResponse as unknown as CheckoutResponse;
      }
      // Review Devin #74 ("Slow retries create duplicate orders"): la espera
      // se agotó pero el dueño puede seguir procesando (PDF/R2, persistencia,
      // CRM, Trello). Respuesta ESTRUCTURADA "en proceso" — el carrito
      // preserva el token de intención y el reintento se adhiere a la reserva
      // existente en vez de crear una segunda orden. Si el dueño terminó
      // fallando, ya liberó la reserva y el reintento se convierte en dueño.
      return buildCheckoutProcessingResponse();
    }

    // Tarifa de delivery configurada por el comercio en Payload.
    // Auditoría 2026-09-04 (P2): si el tenant define tarifa por ZONA
    // (deliveryConfig.zones[].priceDelivery) y el cliente seleccionó un
    // municipio con tarifa, se cobra ESA tarifa — antes se ignoraba y se
    // cobraba siempre la fija aunque la UI anunciara "(+$X)" en el selector.
    //
    // Review Devin #73 (2ª ronda): cuando el tenant tiene zonas, el selector
    // del carrito SOLO ofrece nombres de zona. Un municipio que no coincide
    // con ninguna zona (default del drawer sin tocar, o ISR desactualizada
    // tras renombrar zonas) se RECHAZA con error controlado pidiendo
    // re-selección — nunca se inventa un precio (piso de zona mínima) ni se
    // cae a la fija/0, porque la orden guardaría un total distinto al que el
    // cliente vio. Cliente y servidor solo aceptan casos con montos idénticos:
    //   - tenant SIN zonas → fixedPrice (idéntico en ambos lados)
    //   - tenant CON zonas + municipio válido → priceDelivery de la zona
    //     (o fixedPrice si la zona matchea sin precio numérico — también
    //     idéntico al espejo del drawer)
    const deliveryZones = Array.isArray(tenantDoc.deliveryConfig?.zones)
      ? tenantDoc.deliveryConfig!.zones
      : [];
    const selectedMunicipality = customer.deliveryDetails?.municipality?.trim() ?? '';
    let selectedZone: (typeof deliveryZones)[number] | undefined;
    if (customer.deliveryType === 'delivery' && deliveryZones.length > 0) {
      selectedZone = selectedMunicipality
        ? deliveryZones.find((z) => z.name === selectedMunicipality)
        : undefined;
      if (!selectedZone) {
        return {
          success: false,
          error:
            'Tu zona de entrega ya no es válida para esta tienda. Por favor selecciona nuevamente tu municipio e inténtalo de nuevo.',
        };
      }
    }
    const zonePrice =
      selectedZone && typeof selectedZone.priceDelivery === 'number'
        ? selectedZone.priceDelivery
        : null;
    const deliveryFee =
      customer.deliveryType === 'delivery'
        ? (zonePrice ?? Number(tenantDoc.deliveryConfig?.fixedPrice || 0))
        : 0;

    const total = itemsSubtotal + deliveryFee;

    // ------------------------------------------------------------------
    // 4. Resolve Exchange Rate & Generate Order Number
    // ------------------------------------------------------------------
    const { rate: vesRate } = await resolveExchangeRateVES(tenantDoc);
    // PR 4.3 (H-5): showVES anclado al tenant — branding.showVES !== false
    // es requisito; el request del comprador solo puede APAGAR la línea Bs.
    // de su propia respuesta (showVES === false), nunca encenderla contra la
    // config del comercio. La tasa resuelta sigue siendo condición.
    const showVESEffective = tenantShowVES && showVES !== false && vesRate !== null;
    const totalVES = vesRate ? total * vesRate : 0;

    const orderNumber = await generateUniqueOrderNumber(payload);
    if (!orderNumber) {
      return { success: false, error: 'No se pudo generar un número de pedido único. Intenta de nuevo.' };
    }

    // Auditoría 2026-09-04 (P3): la fecha del PDF usaba la TZ del proceso
    // (UTC en Vercel) — la constitución exige America/Caracas (UTC-4). El
    // prefijo de fecha del orderNumber se genera en generateUniqueOrderNumber,
    // también en Caracas.
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('es-ES', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // ------------------------------------------------------------------
    // 7. Persist Order in Orders Collection & Enqueue Async Job
    // ------------------------------------------------------------------
    // PR 4 (auditoría 2026-09-07, A6): el PDF y el WhatsApp se generan DESPUÉS
    // de este create (secciones 7bis/7ter) — antes vivían aquí arriba y un
    // fallo provocable del create (validación de select, carrera de stock del
    // hook) dejaba un PDF huérfano en R2 + jsPDF quemado por cada intento
    // (~2,1M ops Class A/mes teóricas de abuso sobre el free tier).
    // ------------------------------------------------------------------
    // Teléfono/correo sanitizados ANTES del create (la orden los persiste);
    // el builder de WhatsApp los reutiliza como parámetros — única fuente.
    const cleanedPhone = customer.phone.trim().replace(/[^\d+\s-]/g, '');
    const safePhone =
      cleanedPhone.length > 0 ? cleanedPhone : sanitizePlainText(customer.phone.trim());
    const safeEmail = sanitizePlainText(
      customer.email ? customer.email.trim().toLowerCase() : ''
    );
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
          currency: 'USD',
          // PR 4.3 (H-5 + fix Devin #116): el snapshot VES se persiste SOLO
          // cuando el TENANT lo habilita (branding.showVES !== false) y hay tasa.
          // El snapshot en la orden es la vista OPERATIVA del comercio (Trello y
          // reportes del tenant) y no se apaga por el opt-out transitorio del cliente
          // (review Devin #116: «Client flag suppresses tenant VES records»).
          // El opt-out del cliente para su correo de confirmación viaja por separado
          // en job.input.customerShowVES (fix Devin #116: «Customer VES opt-out ignored in email»).
          exchangeRateVES: tenantShowVES ? (vesRate ?? undefined) : undefined,
        },
      });
      // La orden EXISTE: a partir de aquí la reserva de idempotencia ya no se
      // libera (la respuesta de replay ya está en la clave — ver abajo).
      orderCreated = true;

      // ------------------------------------------------------------------
      // 7bis. Build Structured WhatsApp Message & Sanitize Customer Data
      // ------------------------------------------------------------------
      // PURA (operaciones de string): microsegundos — puede vivir antes de la
      // frontera del replay (8) sin ensanchar la ventana de crash.
      const { whatsappUrl } = buildWhatsappMessagePayload({
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
        safePhone,
        safeEmail,
      });

      // ------------------------------------------------------------------
      // 8. Replay DURADERO de idempotencia en la frontera de creación
      // ------------------------------------------------------------------
      // Review Devin #74 (2ª ronda, "Make the idempotency outcome durable") +
      // review Devin PR #94 ("Post-create work reopens duplicate orders"):
      // reemplazar ATÓMICAMENTE la reserva ('reserved') por la respuesta de
      // replay INMEDIATAMENTE después de payload.create. Entre el create y
      // esta frontera SOLO corre el armado de WhatsApp (puro) — el PDF, que
      // implica red (R2 PUT), va DESPUÉS (8bis): un crash/timeout entre create
      // y respuesta no puede dejar la reserva sin replay (si el proceso muere
      // aquí, el reintento recupera ESTA respuesta y ve su pantalla de éxito
      // en vez de crear una segunda orden tras expirar el TTL — deducción de
      // inventario doble). SET con EX es un reemplazo atómico (nunca convive
      // con el sentinel 'reserved'); releaseCheckoutReservation solo borra
      // valores 'reserved', así que jamás borra este replay. Endurecimiento
      // futuro (opción A de Devin): clave idempotente en la orden con
      // constraint UNIQUE en BD — requiere migración del owner.
      const builtResponse: CheckoutResponse = {
        success: true,
        orderNumber,
        whatsappUrl,
        pdfBase64: undefined,
        pdfUrl: undefined,
        emailSent: false,
        // Totales confirmados por el servidor (fuente oficial del pedido).
        totalUSD: total,
        totalVES: showVESEffective ? totalVES : undefined,
        exchangeRateVES: showVESEffective ? (vesRate ?? undefined) : undefined,
      };
      successResponse = builtResponse;
      await storeCheckoutResponse(idempotencyKey, builtResponse);

      // ------------------------------------------------------------------
      // 8bis. Generate Official Delivery Note PDF & Upload to R2 (A6)
      // ------------------------------------------------------------------
      // MOVIDO: antes corría ANTES del create — cualquier fallo provocable del
      // create (validación de select, carrera de stock del hook de inventario)
      // dejaba un PDF huérfano en R2. Ahora la orden ya existe Y la respuesta
      // de replay ya está almacenada cuando el PDF nace: R2 solo recibe notas
      // de pedidos reales y la ventana de crash sin replay no se ensancha.
      // Si el PDF/PUT tiene éxito se ACTUALIZA la respuesta almacenada (mismo
      // SET atómico): los reintentos obtienen la versión con PDF; si el update
      // falla, los reintentos conservan la v1 sin PDF (degradación aceptable —
      // el comprador actual SÍ recibe su PDF) y el fallo es no-bloqueante.
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
          currency: 'USD',
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

        if (pdfBase64 !== undefined || pdfUrl !== undefined) {
          const withPdf: CheckoutResponse = { ...builtResponse, pdfBase64, pdfUrl };
          successResponse = withPdf;
          try {
            await storeCheckoutResponse(idempotencyKey, withPdf);
          } catch (storePdfErr) {
            // El comprador actual ya recibe el PDF (successResponse); el
            // replay de reintentos conservará la v1 sin PDF. No bloquea.
            console.warn('PDF replay update warning:', storePdfErr);
          }
        }
      } catch (pdfErr) {
        console.warn('PDF generation warning:', pdfErr);
      }

      // ------------------------------------------------------------------
      // 9. CRM del cliente (best-effort) + claim crmCounted + despacho
      // ------------------------------------------------------------------
      // PR 13 (thermo D4): sección extraída a finalizeOrderCrmAndDispatch
      // con params explícitos — upsertCustomerCrm + claim transaccional con
      // compensación (review Devin #92) + Jobs Queue. Semántica idéntica a
      // la revisada en #67/#92/#74; el pedido nunca se bloquea por CRM/queue.
      await finalizeOrderCrmAndDispatch({
        payload,
        tenantId,
        orderDoc: { id: orderDoc.id as number },
        orderNumber,
        customer,
        safePhone,
        safeEmail,
        total,
        verifiedItems,
        now,
        customerShowVES: showVESEffective,
      });
    } catch (orderErr) {
      // El pedido NO se creó (orderCreated=false): liberar la reserva para que
      // el usuario pueda reintentar con el mismo carrito sin esperar el TTL de
      // idempotencia (review Devin #74: TODA salida fallida antes de la
      // creación debe liberar, no solo este catch).
      if (!orderCreated) {
        await releaseCheckoutReservation(idempotencyKey);
      }
      // Auditoría 2026-09-04 (P2): NO loguear el objeto de error crudo — los
      // errores de validación de Payload adjuntan el `data` enviado, que
      // incluye PII del cliente (nombre, teléfono, email, dirección). Basta
      // el mensaje para diagnóstico; el detalle vive en el resultado HTTP.
      console.error(
        '[storelink][checkout] Order creation error:',
        orderErr instanceof Error ? orderErr.message : 'unknown error'
      );
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

    // Review Devin #74 (2ª ronda): la respuesta ya fue PERSISTIDA como replay
    // en la frontera de creación de la orden (7bis) — los reintentos con el
    // mismo token la recuperan aunque este proceso muera a partir de aquí.
    if (!successResponse) {
      // Inalcanzable: solo se llega aquí tras crear la orden y persistir el
      // replay. Fail-loud por si el flujo cambia en el futuro.
      throw new Error('Internal: checkout success response missing after order creation');
    }
    return successResponse;
  } catch (err: unknown) {
    // Review Devin #74: un fallo ANTES de crear la orden (tasa, numeración,
    // PDF, mensaje de WhatsApp) también debe liberar la reserva — si no, el
    // mismo carrito quedaría bloqueado 15 min con "pedido idéntico en proceso"
    // sin que exista orden alguna. Si la orden sí se creó, la reserva se
    // conserva (contiene la respuesta final para los duplicados).
    if (idempotencyKey && !orderCreated) {
      await releaseCheckoutReservation(idempotencyKey);
    }
    // Higiene de PII (auditoría 2026-09-04): solo el mensaje, nunca el objeto.
    console.error(
      '[storelink][checkout] Unhandled processOrder error:',
      err instanceof Error ? err.message : 'unknown error'
    );
    return {
      success: false,
      error: 'Error inesperado al procesar el pedido',
    };
  }
}

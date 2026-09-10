/**
 * Validación del boundary del checkout (PR 4.3, H-3 + flags Devin #116 r3).
 *
 * El comprador anónimo es un writer NO confiable. Esta capa valida
 * fail-fast — ANTES de guards/pricing/tasa/PDF — para que un payload
 * hostil muera sin quemar efectos. La colección Orders aplica la misma
 * cota a TODO writer (doble capa, patrón del PR 4 de la auditoría 09-07).
 *
 * Flags Devin #116 (3ª ronda) que este módulo cierra:
 *  - «Whitespace bypasses boundary text caps»: el boundary medía
 *    trim().length pero la orden persistía el string SIN trim → un valor
 *    "Casa 4" + 10k espacios pasaba el boundary y Payload lo rechazaba
 *    recién en el create, tras pricing y resolución de tasa. Ahora el
 *    objeto customer se NORMALIZA una única vez (normalizeCheckoutCustomer)
 *    y esa copia es la que usan idempotencia, create, PDF, WhatsApp y CRM.
 *  - «Pickup configuration blocks valid checkout»: la dirección de pickup
 *    la armaba el drawer desde pickupConfig del tenant (campos sin cota)
 *    → una config larga bloqueaba TODOS los checkouts pickup aunque el
 *    comprador no ingresara dirección. Ahora la dirección de pickup se
 *    RECONSTRUYE server-side desde el tenantDoc (fuente confiable) y la
 *    cota de `address` solo aplica al texto del COMPRADOR (delivery).
 */

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
  /**
   * Review Devin #74: token de intención del checkout generado por el carrito
   * (crypto.randomUUID). Estable durante un intento (sobrevive reintentos de
   * transporte del mismo body) y distinto en cada compra nueva. Opcional y
   * sanitizado en el servidor: si falta o es inválido, la idempotencia cae al
   * fingerprint de contenido.
   */
  idempotencyToken?: string;
}

// Whitelists de enums del PR 4 (auditoría 2026-09-07, A6): un valor inválido
// de deliveryType/methodKey/currency lo RECHAZARÍA Payload recién en el
// payload.create — para entonces el PDF ya estaría en R2 (huérfano + cuota
// quemada por intento provocable). Estas validaciones corren en el boundary
// fail-fast, antes de cualquier efecto.
import {
  validateCurrencyCode,
  validateDeliveryTypeEnum,
  validateMethodKeyEnum,
} from '@/lib/checkout-sanitize';

/** Cotas de texto (espejo exacto de los maxLength de src/collections/Orders.ts). */
export const CHECKOUT_TEXT_LIMITS = {
  name: 120,
  phone: 40,
  email: 200,
  /** Agregado delivery del drawer: residenceZone(200)+buildingHouse(200)+municipality(120)+etiquetas(~43). */
  address: 600,
  /** Etiqueta agregada de pago: emisor(≤200)+referencia(≤200)+plantillas del drawer. */
  paymentMethod: 500,
  notes: 1000,
  municipality: 120,
  residenceZone: 200,
  buildingHouse: 200,
  referencePoint: 300,
} as const;

/**
 * Normalización UNICA del texto del comprador: trim del string que se
 * persiste. La cota se mide SOBRE el valor normalizado (el mismo que ve
 * el maxLength del schema) y se RECHAZA en el boundary si excede — ya no
 * existe divergencia trim/sin-trim que permita colar 10k espacios por el
 * boundary (flag Devin #116 r3: «Whitespace bypasses boundary text caps»).
 * undefined se preserva (los campos opcionales siguen opcionales). NO se
 * trunca aquí: un valor genuinamente excedido debe producir error visible
 * al comprador (la dirección truncada no es entregable), no un silencioso
 * recorte que además dejaría las cotas del boundary como código muerto.
 */
export function normalizeCustomerTextField(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/** Validador puro de cotas sobre texto YA normalizado (sin re-trim). */
function isWithinLimit(value: string | undefined, limit: number): boolean {
  return value === undefined || value.length <= limit;
}

/**
 * Normaliza el objeto customer completo a SU copia persistible: trim en
 * todos los campos de texto (sin truncar — los excesos los RECHAZA el
 * boundary con mensaje visible; una dirección truncada no es entregable).
 * Esta copia (nunca el request crudo) es la que consumen idempotencia,
 * payload.create, PDF, WhatsApp y CRM — única fuente de verdad del texto.
 *
 * Los subcampos de entrega y pago se normalizan a nivel de campo: si un
 * subcampo queda vacío tras trim se OMITE (undefined) en la copia para no
 * persistir strings en blanco; el grupo completo vacío se omite entero.
 */
export function normalizeCheckoutCustomer(
  raw: CheckoutCustomerData,
): CheckoutCustomerData {
  const normalized: CheckoutCustomerData = {
    name: normalizeCustomerTextField(raw.name) ?? '',
    phone: normalizeCustomerTextField(raw.phone) ?? '',
    email: normalizeCustomerTextField(raw.email),
    address: normalizeCustomerTextField(raw.address),
    paymentMethod: normalizeCustomerTextField(raw.paymentMethod),
    notes: normalizeCustomerTextField(raw.notes),
    deliveryType: raw.deliveryType,
  };

  const dd = raw.deliveryDetails;
  if (dd && typeof dd === 'object') {
    const municipality = normalizeCustomerTextField(dd.municipality);
    const residenceZone = normalizeCustomerTextField(dd.residenceZone);
    const buildingHouse = normalizeCustomerTextField(dd.buildingHouse);
    const referencePoint = normalizeCustomerTextField(dd.referencePoint);
    normalized.deliveryDetails =
      municipality || residenceZone || buildingHouse || referencePoint
        ? { municipality, residenceZone, buildingHouse, referencePoint }
        : undefined;
  }

  // paymentDetails se normaliza aparte (normalizePaymentDetails en
  // checkout-sanitize: whitelist de claves + force de paymentStatus) —
  // aquí solo se propaga la referencia ya saneada.
  normalized.paymentDetails = raw.paymentDetails;

  return normalized;
}

/**
 * Dirección de pickup RECONSTRUIDA en el servidor (flag Devin #116 r3:
 * «Pickup configuration blocks valid checkout»). El drawer dejaba de armar
 * este texto desde la config del tenant sin cotas: una config larga rompía
 * el maxLength de address para TODOS los compradores pickup. Ahora:
 *  - Fuente CONFIRMADA (tenantDoc): el comprador no puede inyectar su
 *    propia "dirección" de pickup (el campo del request se ignora).
 *  - La cota de address (600) NO se aplica a este texto: los campos fuente
 *    del tenant se acotarán en el schema de Tenants (400/150) y el worst
 *    case del agregado (400 + 150 + etiquetas ~42 = 592) cabe en 600 por
 *    diseño. Por robustez ante configs legadas ya guardadas, el texto se
 *    trunca a 600 (slice, nunca rechazo del pedido del comprador).
 *  - Mismos defaults que el drawer mostraba (nombre de tienda / horario
 *    estándar) cuando el tenant no configuró pickup: el comprador no
 *    percibe diferencia.
 */
export function buildPickupAddress(
  tenant: { name?: string | null },
  pickupConfig: { locationAddress?: string | null; schedule?: string | null } | undefined,
): string {
  const loc = pickupConfig?.locationAddress?.trim();
  const sched = pickupConfig?.schedule?.trim();
  const effectiveLoc = loc || (tenant.name ? `${tenant.name} - Sede Principal` : 'Sede Principal');
  const effectiveSched = sched || 'Lun-Dom 11:30 AM - 10:00 PM';
  return `[RETIRO EN TIENDA / PICKUP] ${effectiveLoc} (Horario: ${effectiveSched})`.slice(0, 600);
}

/**
 * Boundary validation del request de checkout (fail-fast, sin efectos).
 * Recibe el customer YA normalizado (normalizeCheckoutCustomer): las cotas
 * aquí usan la MISMA string que se persistirá — cerrando el bypass por
 * whitespace. `address` solo se acota en delivery: en pickup la dirección
 * se reconstruye server-side (buildPickupAddress) y la del request se
 * ignora por completo.
 */
export function validateCheckoutInput(request: CheckoutRequest): {
  ok: true;
} | {
  ok: false;
  error: string;
} {
  const { tenantSlug, customer, items, currency } = request;

  if (!tenantSlug || typeof tenantSlug !== 'string' || tenantSlug.trim().length === 0) {
    return { ok: false, error: 'Identificador de tienda inválido' };
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'El carrito está vacío' };
  }

  // MAX_CHECKOUT_ITEMS vive en src/lib/constants.ts (única fuente) — la
  // Server Action lo importa; aquí solo se valida shape mínimo del array.
  if (!customer || typeof customer !== 'object') {
    return { ok: false, error: 'Datos del cliente incompletos' };
  }

  const { name, phone, email, address, notes, paymentMethod, deliveryDetails } = customer;

  if (!name || !phone || !email) {
    return { ok: false, error: 'Por favor completa el nombre, teléfono y correo de contacto' };
  }

  // Validación básica de formato de correo
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { ok: false, error: 'Por favor introduce un correo electrónico válido' };
  }

  // Whitelists de enums (PR 4, A6): fail-fast ANTES de pricing/PDF/R2 —
  // Payload también los rechazaría, pero para entonces el PDF ya existiría.
  const deliveryTypeError = validateDeliveryTypeEnum(customer.deliveryType);
  if (deliveryTypeError) return { ok: false, error: deliveryTypeError };

  const methodKeyError = validateMethodKeyEnum(customer.paymentDetails?.methodKey);
  if (methodKeyError) return { ok: false, error: methodKeyError };

  const currencyError = validateCurrencyCode(currency);
  if (currencyError) return { ok: false, error: currencyError };

  // Cotas de texto sobre el valor NORMALIZADO (mismas que Orders.ts). El
  // trim ya ocurrió en normalizeCheckoutCustomer: medir aquí ES medir lo
  // que Payload persistirá. Un exceso de whitespace no puede pasar.
  if (!isWithinLimit(name, CHECKOUT_TEXT_LIMITS.name)) {
    return { ok: false, error: 'El nombre es demasiado largo' };
  }
  if (!isWithinLimit(phone, CHECKOUT_TEXT_LIMITS.phone)) {
    return { ok: false, error: 'El teléfono es demasiado largo' };
  }
  if (!isWithinLimit(email, CHECKOUT_TEXT_LIMITS.email)) {
    return { ok: false, error: 'El correo es demasiado largo' };
  }

  if (customer.deliveryType !== 'pickup') {
    // `address` es la dirección FORMATEADA que el drawer arma concatenando
    // residenceZone(200) + buildingHouse(200) + municipality(120) + etiquetas
    // (~43) → peor caso ~563 chars. Cota de 600 para el agregado legítimo
    // (review Devin #116 r1: "Valid delivery fields exceed aggregate cap").
    // En pickup NO se valida: la dirección final la construye el servidor
    // desde tenantDoc (flag Devin #116 r3: «Pickup configuration blocks
    // valid checkout») — el request del comprador no la define.
    if (!isWithinLimit(address, CHECKOUT_TEXT_LIMITS.address)) {
      return { ok: false, error: 'La dirección es demasiado larga' };
    }
  }

  if (!isWithinLimit(notes, CHECKOUT_TEXT_LIMITS.notes)) {
    return { ok: false, error: 'Las notas son demasiado largas' };
  }

  const dd = deliveryDetails;
  if (dd && typeof dd === 'object') {
    if (!isWithinLimit(dd.municipality, CHECKOUT_TEXT_LIMITS.municipality)) {
      return { ok: false, error: 'Datos de entrega inválidos' };
    }
    if (!isWithinLimit(dd.residenceZone, CHECKOUT_TEXT_LIMITS.residenceZone)) {
      return { ok: false, error: 'Datos de entrega inválidos' };
    }
    if (!isWithinLimit(dd.buildingHouse, CHECKOUT_TEXT_LIMITS.buildingHouse)) {
      return { ok: false, error: 'Datos de entrega inválidos' };
    }
    if (!isWithinLimit(dd.referencePoint, CHECKOUT_TEXT_LIMITS.referencePoint)) {
      return { ok: false, error: 'Datos de entrega inválidos' };
    }
  }

  // `paymentMethod` es la ETIQUETA agregada que el drawer arma incrustando
  // emisor + referencia (cada uno acotado a 200 en checkout-sanitize) → peor
  // caso ~440 chars. Cota 500 para el agregado legítimo (review Devin #116
  // r1: «Valid payment labels exceed new cap»). Los campos fuente viven en
  // paymentDetails (acotados por separado).
  if (!isWithinLimit(paymentMethod, CHECKOUT_TEXT_LIMITS.paymentMethod)) {
    return { ok: false, error: 'Datos de pago inválidos' };
  }

  return { ok: true };
}

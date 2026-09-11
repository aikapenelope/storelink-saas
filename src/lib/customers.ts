/**
 * Helper compartido de clientes y WhatsApp para Storelink SaaS.
 * Centraliza la sanitización de teléfonos venezolanos, la generación de enlaces
 * directos wa.me y la lógica de clasificación de segmentos RFM.
 */

export type CustomerSegment = 'vip' | 'frecuente' | 'nuevo' | 'inactivo';

/**
 * Normaliza un número telefónico para WhatsApp.
 * - Elimina cualquier carácter que no sea dígito (+, -, espacios, paréntesis).
 * - Si comienza por '0' (formato local ej. 04141234567), remueve el 0 inicial.
 * - Si tiene 10 dígitos (número venezolano sin prefijo internacional ej. 4141234567), antepone '58'.
 * - Si ya tiene el prefijo de país (ej. 584141234567), lo conserva.
 */
export function normalizeCustomerPhone(rawPhone: string): string {
  if (!rawPhone) return '';
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';

  // Quitar ceros a la izquierda (ej. 0414... -> 414...)
  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }

  // Número celular o fijo venezolano típico de 10 dígitos (414, 424, 412, 416, 426, 212, etc.)
  if (digits.length === 10) {
    return `58${digits}`;
  }

  return digits;
}

/**
 * Genera una URL directa de WhatsApp (wa.me) con mensaje prellenado.
 */
export function buildCustomerWhatsAppUrl(rawPhone: string, message: string = ''): string {
  const normalized = normalizeCustomerPhone(rawPhone);
  if (!normalized) return '';

  const encodedText = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${normalized}${encodedText}`;
}

/**
 * Clasifica a un cliente en su segmento RFM correspondiente:
 * - 'vip': 3 o más pedidos, o gasto >= $50, o marcado manualmente con tag 'vip'.
 * - 'frecuente': 2 pedidos realizados, o tag 'frecuente'.
 * - 'inactivo': tag 'inactivo', o más de 60 días sin compras registradas.
 * - 'nuevo': 0 o 1 pedido, activo en los últimos 60 días.
 */
export function computeCustomerSegment(customer: {
  totalOrders?: number | null;
  totalSpent?: number | null;
  tag?: string | null;
  lastOrderAt?: string | null | Date;
}): CustomerSegment {
  const orders = Number(customer.totalOrders) || 0;
  const spent = Number(customer.totalSpent) || 0;
  const tag = customer.tag;

  if (tag === 'vip' || orders >= 3 || spent >= 50) {
    return 'vip';
  }

  if (tag === 'frecuente' || orders === 2) {
    return 'frecuente';
  }

  if (tag === 'inactivo') {
    return 'inactivo';
  }

  if (customer.lastOrderAt) {
    const lastOrderTime =
      customer.lastOrderAt instanceof Date
        ? customer.lastOrderAt.getTime()
        : new Date(customer.lastOrderAt).getTime();

    if (!isNaN(lastOrderTime)) {
      const daysSince = (Date.now() - lastOrderTime) / (1000 * 60 * 60 * 24);
      if (daysSince > 60) {
        return 'inactivo';
      }
    }
  }

  return 'nuevo';
}

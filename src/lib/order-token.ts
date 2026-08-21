import { createHash, timingSafeEqual } from 'crypto';

/**
 * Token opaco por pedido para descargar la Nota de Entrega en PDF sin sesión.
 * Derivado de PAYLOAD_SECRET (nunca expuesto), determinístico por orderNumber,
 * comparable en tiempo constante. Lo genera el checkout y lo consume
 * /api/orders/[id]/pdf. No es una feature de Payload: es autorización de
 * aplicación a nivel de ruta Next.js, complementaria al access control de las
 * colecciones (https://payloadcms.com/docs/access-control/overview).
 */
export function orderPdfToken(orderNumber: string): string {
  return createHash('sha256')
    .update(`${orderNumber}:${process.env.PAYLOAD_SECRET || ''}`)
    .digest('hex')
    .slice(0, 32);
}

export function verifyOrderPdfToken(orderNumber: string, provided: string): boolean {
  const expected = orderPdfToken(orderNumber);
  const bufA = Buffer.from(expected);
  const bufB = Buffer.from(provided || '');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

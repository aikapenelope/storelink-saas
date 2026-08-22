import { createHash, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

/**
 * Token opaco por pedido para descargar la Nota de Entrega en PDF sin sesión.
 * Derivado de PAYLOAD_SECRET (nunca expuesto), con expiración de 48h embebida
 * (`.exp` en base36), comparable en tiempo constante. Lo genera el checkout y
 * lo consume /api/orders/[id]/pdf. No es una feature de Payload: es
 * autorización de aplicación a nivel de ruta Next.js, complementaria al
 * access control de las colecciones
 * (https://payloadcms.com/docs/access-control/overview).
 */
export function orderPdfToken(orderNumber: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const digest = createHash('sha256')
    .update(`${orderNumber}:${exp}:${process.env.PAYLOAD_SECRET || ''}`)
    .digest('hex')
    .slice(0, 32);
  return `${digest}.${exp.toString(36)}`;
}

export function verifyOrderPdfToken(orderNumber: string, provided: string): boolean {
  const [digest, expBase36] = (provided || '').split('.');
  if (!digest || !expBase36) {
    return false;
  }

  const exp = Number.parseInt(expBase36, 36);
  if (!Number.isFinite(exp) || Date.now() > exp) {
    return false;
  }

  const expected = createHash('sha256')
    .update(`${orderNumber}:${exp}:${process.env.PAYLOAD_SECRET || ''}`)
    .digest('hex')
    .slice(0, 32);

  const bufA = Buffer.from(expected);
  const bufB = Buffer.from(digest);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
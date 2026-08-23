import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Nonce firmado del checkout (Sprint 5, ROADMAP_V2 §4).
 *
 * Al renderizar la tienda se emite un token HMAC ligado a tenantSlug + una
 * ventana de tiempo redondeada a 30 min. El redondeo es lo que hace el token
 * compatible con ISR (revalidate=300): todos los renders dentro de la misma
 * ventana producen el MISMO nonce y la página estática nunca queda con un
 * token "a punto de caducar" distinto por visitante.
 *
 * Límite conocido y aceptado: NO es single-use (todos los visitantes del
 * tenant comparten el nonce de la ventana). Es un filtro de bots que obliga a
 * pasar por el storefront antes de golpear la Server Action; la cota de
 * volumen por IP la pone el rate-limit (src/lib/rate-limit.ts), no este token.
 */

const WINDOW_MS = 30 * 60 * 1000;
const NONCE_PATTERN = /^(\d+)\.([a-f0-9]{64})$/;

function signingSecret(): string {
  return process.env.CHECKOUT_NONCE_SECRET || process.env.PAYLOAD_SECRET || '';
}

export function checkoutWindowStart(now: number = Date.now()): number {
  return Math.floor(now / WINDOW_MS) * WINDOW_MS;
}

function signWindow(tenantSlug: string, windowStart: number): string {
  return createHmac('sha256', signingSecret())
    .update(`${tenantSlug}:${windowStart}`)
    .digest('hex');
}

export function issueCheckoutNonce(tenantSlug: string, now: number = Date.now()): string {
  if (!signingSecret()) {
    throw new Error('Nonce de checkout sin secreto: configura CHECKOUT_NONCE_SECRET o PAYLOAD_SECRET');
  }
  const windowStart = checkoutWindowStart(now);
  return `${windowStart}.${signWindow(tenantSlug, windowStart)}`;
}

/**
 * Acepta la ventana actual Y la anterior: un cliente que abrió la tienda al
 * final de una ventana sigue pudiendo enviar su pedido hasta 60 min después
 * sin falsos rechazos (y sin romper ISR).
 */
export function validateCheckoutNonce(
  nonce: string,
  tenantSlug: string,
  now: number = Date.now()
): boolean {
  const secret = signingSecret();
  if (!secret) {
    console.warn('Nonce de checkout sin secreto: falta CHECKOUT_NONCE_SECRET/PAYLOAD_SECRET');
    return false;
  }
  const match = NONCE_PATTERN.exec(nonce || '');
  if (!match) return false;

  const windowStart = Number(match[1]);
  const currentWindow = checkoutWindowStart(now);
  if (windowStart !== currentWindow && windowStart !== currentWindow - WINDOW_MS) {
    return false;
  }

  const expected = Buffer.from(signWindow(tenantSlug, windowStart), 'hex');
  const received = Buffer.from(match[2], 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

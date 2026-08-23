import { validateCheckoutNonce } from './checkout-nonce';
import { checkCheckoutRateLimit } from './rate-limit';

/**
 * Orquestador de las trampas anti-abuso del checkout (Sprint 5):
 *   1. Nonce HMAC (local, gratis)
 *   2. Honeypot + tiempo mínimo de formulario (local, gratis)
 *   3. Rate-limit por IP+tenant (1 comando Redis)
 *
 * El orden va de más barato a más caro; el rechazo es SIEMPRE genérico para
 * no revelar cuál trampa atrapó al remitente. Funciones puras/inyectables:
 * los tests no necesitan mockear next/headers ni Payload.
 */

const MIN_FORM_FILL_MS = 3000;
const MAX_CLOCK_SKEW_MS = 2000;

const GENERIC_ERROR = 'No se pudo validar el pedido. Recarga la página e inténtalo de nuevo.';
const RATE_LIMIT_ERROR = 'Demasiados intentos. Espera un momento y vuelve a intentarlo.';

export interface CheckoutGuardInput {
  tenantSlug: string;
  nonce: string;
  honeypotWebsite?: string;
  formRenderedAtMs?: number;
  clientIp: string;
  /** Inyectable para tests deterministas (default Date.now()) */
  now?: number;
}

export type CheckoutGuardResult = { ok: true } | { ok: false; error: string };

/** true = el envío parece humano. Bot típico: rellena campos ocultos y/o envía en <3s. */
export function evaluateHoneypot(
  input: { honeypotWebsite?: string; formRenderedAtMs?: number },
  now: number = Date.now()
): boolean {
  if (typeof input.honeypotWebsite === 'string' && input.honeypotWebsite.trim() !== '') {
    return false;
  }
  const renderedAt = Number(input.formRenderedAtMs);
  if (!Number.isFinite(renderedAt) || renderedAt <= 0) return false;
  if (renderedAt > now + MAX_CLOCK_SKEW_MS) return false;
  if (now - renderedAt < MIN_FORM_FILL_MS) return false;
  return true;
}

export async function evaluateCheckoutGuards(input: CheckoutGuardInput): Promise<CheckoutGuardResult> {
  const now = input.now ?? Date.now();
  if (!validateCheckoutNonce(input.nonce, input.tenantSlug, now)) {
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!evaluateHoneypot(input, now)) {
    return { ok: false, error: GENERIC_ERROR };
  }
  const verdict = await checkCheckoutRateLimit(`${input.clientIp}:${input.tenantSlug}`);
  if (!verdict.allowed) {
    return { ok: false, error: RATE_LIMIT_ERROR };
  }
  return { ok: true };
}

/**
 * IP del cliente tras el proxy de Vercel: primer valor de x-forwarded-for
 * (la plataforma normaliza/sobreescribe esta cabecera; nunca confiar en las
 * siguientes, que pueden ser añadidas por el cliente).
 */
export function clientIpFromHeaders(headersList: Headers): string {
  const xff = headersList.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return headersList.get('x-real-ip')?.trim() || 'unknown';
}

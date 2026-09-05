import { createHash } from 'crypto';
import { Redis } from '@upstash/redis';

/**
 * Idempotencia del checkout (auditoría 2026-09-04, P1-2).
 *
 * El nonce anti-abuso NO es single-use (decisión documentada: se comparte por
 * tenant durante la ventana ISR), así que un doble clic, un reenvío desde otra
 * pestaña o el reintento del navegador tras un timeout creaban DOS órdenes
 * (stock deducido dos veces, dos WhatsApp, dos tarjetas Trello, CRM doble).
 *
 * Mecanismo: clave determinista = SHA-256 de (tenant, items normalizados,
 * datos del cliente). Antes de crear la orden se hace `SET NX EX`:
 *  - NX ok  → este request es el "dueño" del pedido; al terminar se guarda la
 *             respuesta final en la misma clave para que el duplicado la
 *             reciba tal cual (pantalla de éxito, no error).
 *  - NX dup → esperar brevemente la respuesta del dueño y devolverla; si no
 *             aparece a tiempo, error claro (nunca segunda orden).
 *
 * Fail-open por diseño (misma decisión documentada en src/lib/rate-limit.ts):
 * si Upstash no está configurado o falla, el checkout sigue sin idempotencia
 * — la disponibilidad nunca depende del anti-duplicado. La cota por
 * IP+tenant/tenant sigue activa como segunda capa.
 */

const IDEMPOTENCY_TTL_SECONDS = 15 * 60; // ventana razonable para reintentos del navegador
const DUPLICATE_WAIT_MS = 2500;
const DUPLICATE_POLL_MS = 250;

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn(
      'Idempotencia de checkout desactivada: faltan UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN'
    );
    redis = null;
    return redis;
  }
  redis = new Redis({ url, token });
  return redis;
}

/** Forma normalizada y estable de los datos que definen "el mismo pedido". */
export interface IdempotencyOrderData {
  tenantId: number | string;
  items: Array<{
    sku?: string | null;
    quantity?: number | null;
    modifiers?: string[] | null;
  }>;
  customerPhone: string;
  customerEmail: string;
  deliveryType?: string | null;
  municipality?: string | null;
}

/**
 * Clave determinista del pedido. Determinismo verificado en
 * tests/unit/checkout-idempotency.test.ts: mismo carrito → misma clave;
 * cualquier cambio de item/cantidad/modificadores/cliente → clave distinta.
 * El prefijo incluye la versión del algoritmo para poder rotarlo sin colisiones.
 */
export function buildIdempotencyKey(data: IdempotencyOrderData): string {
  const normalizedItems = [...(data.items ?? [])]
    .map((item) => ({
      sku: String(item.sku ?? ''),
      quantity: Number(item.quantity) || 0,
      modifiers: [...(item.modifiers ?? [])].sort().join('|'),
    }))
    .sort((a, b) => (a.sku === b.sku ? a.quantity - b.quantity : a.sku.localeCompare(b.sku)))
    .map((item) => `${item.sku}x${item.quantity}+${item.modifiers}`)
    .join(';');

  const fingerprint = [
    String(data.tenantId),
    normalizedItems,
    data.customerPhone.trim().toLowerCase(),
    data.customerEmail.trim().toLowerCase(),
    data.deliveryType ?? '',
    data.municipality ?? '',
  ].join('¦');

  return `storelink:idem:v1:${createHash('sha256').update(fingerprint).digest('hex')}`;
}

/**
 * Intenta reservar el "slot" del pedido. true = este request lo procesa;
 * false = otro request idéntico lo está procesando ya (o lo procesó).
 */
export async function tryReserveCheckout(key: string): Promise<boolean> {
  const client = getRedis();
  if (!client) return true; // fail-open

  try {
    const result = await client.set(key, 'reserved', {
      nx: true,
      ex: IDEMPOTENCY_TTL_SECONDS,
    });
    return result === 'OK';
  } catch (err) {
    console.warn('Idempotencia no disponible (fail-open):', err);
    return true;
  }
}

/**
 * Libera la reserva si el pedido NO llegó a crearse (p.ej. stock insuficiente):
 * el usuario debe poder reintentar con el mismo carrito sin esperar el TTL.
 * Nunca se libera si la orden se creó (la respuesta ya fue guardada).
 */
export async function releaseCheckoutReservation(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    // Solo borra si sigue siendo 'reserved' (no la respuesta ya guardada).
    const current = await client.get<string>(key);
    if (current === 'reserved') {
      await client.del(key);
    }
  } catch (err) {
    console.warn('No se pudo liberar la reserva idempotente (no bloquea):', err);
  }
}

/** Guarda la respuesta final para que los duplicados la reciban tal cual. */
export async function storeCheckoutResponse(
  key: string,
  response: object
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.set(key, JSON.stringify(response), { ex: IDEMPOTENCY_TTL_SECONDS });
  } catch (err) {
    console.warn('No se pudo guardar la respuesta idempotente (no bloquea el pedido):', err);
  }
}

/**
 * Espera la respuesta del request dueño del pedido. Devuelve null si no
 * aparece en la ventana de espera (el dueño sigue procesando o falló).
 */
export async function waitForCheckoutResponse(
  key: string,
  timeoutMs = DUPLICATE_WAIT_MS
): Promise<unknown> {
  const client = getRedis();
  if (!client) return null;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, DUPLICATE_POLL_MS));
    try {
      const raw = await client.get<string>(key);
      if (raw && raw !== 'reserved') {
        return JSON.parse(raw) as unknown;
      }
    } catch (err) {
      console.warn('No se pudo leer la respuesta idempotente (fail-open):', err);
      return null;
    }
  }
  return null;
}

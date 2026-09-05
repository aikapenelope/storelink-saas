/**
 * Ciclo de vida del token de intención del checkout (review Devin #74, 2ª
 * ronda: "Persist the checkout intent token with the tenant's cart").
 *
 * El token debe sobrevivir a RELOADS y compartirse entre PESTAÑAS mientras el
 * carrito represente la misma compra: vive en localStorage junto al ciclo de
 * vida del carrito del tenant (flow_cart_<slug>), no en un ref de React.
 *
 * Contrato de rotación:
 *  - Se CREA al primer submit del intento (lazy) y se persiste.
 *  - Se PRESERVA en resultados "en proceso" y en fallos de transporte
 *    (el reintento debe recaer en la MISMA reserva de idempotencia).
 *  - Se LIMPIA/ROTA tras un resultado TERMINAL (éxito o fallo definitivo
 *    antes de crear la orden) o una compra nueva intencional (carrito
 *    vaciado — el mismo momento en que StorefrontClient borra su storage).
 *
 * Módulo isomórfico: sin dependencias de Node. El storage se inyecta para
 * poder testear reload/segunda-pestaña y para degradar sin lanzar cuando
 * localStorage no está disponible (modo privado/cuotas).
 */

const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** Clave del token, namespaced por tenant — muere y nace con el carrito. */
export function checkoutIntentStorageKey(tenantSlug: string): string {
  return `flow_checkout_intent_${tenantSlug}`;
}

/** Genera un token válido para el server action (uuid o fallback seguro). */
export function newCheckoutIntentToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `chk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Lee el token persistido; null si no existe o está corrupto. */
export function readCheckoutIntentToken(
  storage: Storage | null | undefined,
  tenantSlug: string
): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(checkoutIntentStorageKey(tenantSlug));
    if (raw && TOKEN_RE.test(raw)) return raw;
    return null;
  } catch {
    // localStorage bloqueado (modo privado/cuotas): sin token persistido.
    return null;
  }
}

/** Persiste el token. Silencioso si el storage no está disponible. */
export function saveCheckoutIntentToken(
  storage: Storage | null | undefined,
  tenantSlug: string,
  token: string
): void {
  if (!storage || !TOKEN_RE.test(token)) return;
  try {
    storage.setItem(checkoutIntentStorageKey(tenantSlug), token);
  } catch {
    // Silencioso: cuota excedida / storage bloqueado.
  }
}

/** Limpia el token (resultado terminal o compra nueva intencional). */
export function clearCheckoutIntentToken(
  storage: Storage | null | undefined,
  tenantSlug: string
): void {
  if (!storage) return;
  try {
    storage.removeItem(checkoutIntentStorageKey(tenantSlug));
  } catch {
    // Silencioso.
  }
}

/**
 * Devuelve el token del intento actual: el persistido si existe (recarga o
 * segunda pestaña con el mismo carrito), o uno nuevo generado y persistido.
 * Si el storage no está disponible devuelve un token efímero de sesión (la
 * idempotencia funciona dentro de la página; no sobrevive al reload).
 */
export function getOrCreateCheckoutIntentToken(
  storage: Storage | null | undefined,
  tenantSlug: string
): string {
  const existing = readCheckoutIntentToken(storage, tenantSlug);
  if (existing) return existing;
  const token = newCheckoutIntentToken();
  saveCheckoutIntentToken(storage, tenantSlug, token);
  return token;
}
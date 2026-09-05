import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Rate-limit del checkout sobre Upstash Redis (patrón estándar en Vercel
 * serverless: Payload 3 eliminó su rate-limit nativo y el contador debe ser
 * estado compartido entre instancias efímeras, que la memoria de proceso no
 * puede dar). 1 comando Redis por intento; las claves expiran solas (TTL),
 * sin limpieza manual ni crons.
 *
 * FAIL-OPEN decidido con el dueño: si no hay env vars o Redis no responde,
 * se permite el checkout y se registra warning. Un incidente de Upstash no
 * debe tumbar las ventas; honeypot+nonce siguen activos como filtro local.
 */

export function parseRateLimitMax(raw: string | undefined): number {
  const configured = Number(raw);
  return Number.isFinite(configured) && configured > 0 ? configured : 5;
}

// Singleton por instancia serverless: conexión reutilizada entre invocaciones.
let limiter: Ratelimit | null | undefined;

function getCheckoutLimiter(): Ratelimit | null {
  if (limiter !== undefined) return limiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn('Rate-limit desactivado: faltan UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN');
    limiter = null;
    return limiter;
  }

  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(parseRateLimitMax(process.env.RATE_LIMIT_CHECKOUT_PER_MIN), '60 s'),
    prefix: 'storelink:checkout',
  });
  return limiter;
}

export interface RateLimitVerdict {
  allowed: boolean;
  remaining?: number;
}

export async function checkCheckoutRateLimit(identifier: string): Promise<RateLimitVerdict> {
  const rl = getCheckoutLimiter();
  if (!rl) return { allowed: true };

  try {
    const result = await rl.limit(identifier);
    return { allowed: result.success, remaining: result.remaining };
  } catch (err) {
    console.warn('Rate-limit no disponible (fail-open):', err);
    return { allowed: true };
  }
}

/**
 * Rate-limit de rutas de administración (plan v2 R8): mismas garantías que el
 * checkout — contador compartido en Upstash entre instancias efímeras y
 * FAIL-OPEN decidido con el dueño. Cotas POR USUARIO autenticado (calibradas
 * provisionales; NV4 = plan Vercel efectivo pendiente de confirmar):
 * import-csv 2/min · sync-sheets 4/min · orders status|pdf 30/min · exchange-rate 10/min.
 */
export const ADMIN_ROUTE_LIMITS = {
  'import-csv': 2,
  'sync-sheets': 4,
  'order-status': 30,
  'order-pdf': 30,
  'exchange-rate': 10,
  // Derecho al olvido (auditoría 2026-09-04): operación destructiva de PII —
  // cota estricta por usuario; 5/min sobra para uso legítimo del admin.
  'anonymize-customer': 5,
} as const;

export type AdminRouteKey = keyof typeof ADMIN_ROUTE_LIMITS;

/**
 * Rate-limit por tenant para protección contra abuso distribuido.
 * Complementa el rate-limit por IP+tenant al agregar un contador compartido
 * específico por tenant_id. Útil para prevenir ataques coordinados desde múltiples IPs.
 *
 * Review Graphify #64: el límite de CHECKOUT por tenant se lee de env con
 * default 50/min. 50 pedidos/min es una cota anti-abuso razonable, pero una
 * tienda en pico legítimo (promo, lanzamiento) puede superarla y bloquearía a
 * TODOS sus clientes durante ese minuto (failure mode tenant-wide). El dueño
 * puede subirlo con RATE_LIMIT_TENANT_CHECKOUT_PER_MIN (ej. 200) sin deploy.
 */
const TENANT_RATE_LIMITS = {
  'checkout': tenantCheckoutRateMax(), // 50/min default, env-configurable
  'import-csv': 5, // 5 importaciones/min por tenant
  'sync-sheets': 10, // 10 sincronizaciones/min por tenant
} as const;

function tenantCheckoutRateMax(): number {
  const raw = process.env.RATE_LIMIT_TENANT_CHECKOUT_PER_MIN;
  const configured = Number(raw);
  return Number.isFinite(configured) && configured > 0 ? configured : 50;
}

export type TenantRateLimitKey = keyof typeof TENANT_RATE_LIMITS;

const tenantLimiters = new Map<string, Ratelimit | null>();

function getTenantLimiter(tenantId: number | string, route: TenantRateLimitKey): Ratelimit | null {
  const key = `${tenantId}:${route}`;
  if (tenantLimiters.has(key)) return tenantLimiters.get(key) ?? null;
  
  const redis = getSharedRedis();
  const rl = redis
    ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(TENANT_RATE_LIMITS[route], '60 s'),
      prefix: `storelink:tenant:${route}`,
    })
    : null;
  tenantLimiters.set(key, rl);
  return rl;
}

export async function checkTenantRateLimit(
  tenantId: number | string,
  route: TenantRateLimitKey
): Promise<RateLimitVerdict> {
  const rl = getTenantLimiter(tenantId, route);
  if (!rl) return { allowed: true };

  try {
    const result = await rl.limit(String(tenantId));
    return { allowed: result.success, remaining: result.remaining };
  } catch (err) {
    console.warn('Tenant rate-limit no disponible (fail-open):', err);
    return { allowed: true };
  }
}

let sharedRedis: Redis | null | undefined;

function getSharedRedis(): Redis | null {
  if (sharedRedis !== undefined) return sharedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn('Rate-limit admin desactivado: faltan UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN');
    sharedRedis = null;
    return sharedRedis;
  }
  sharedRedis = new Redis({ url, token });
  return sharedRedis;
}

const adminLimiters = new Map<AdminRouteKey, Ratelimit | null>();

function getAdminLimiter(route: AdminRouteKey): Ratelimit | null {
  if (adminLimiters.has(route)) return adminLimiters.get(route) ?? null;
  const redis = getSharedRedis();
  const rl = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(ADMIN_ROUTE_LIMITS[route], '60 s'),
        prefix: `storelink:${route}`,
      })
    : null;
  adminLimiters.set(route, rl);
  return rl;
}

export async function checkAdminRouteRateLimit(
  route: AdminRouteKey,
  userId: number | string
): Promise<RateLimitVerdict> {
  const rl = getAdminLimiter(route);
  if (!rl) return { allowed: true };

  try {
    const result = await rl.limit(`user:${userId}`);
    return { allowed: result.success, remaining: result.remaining };
  } catch (err) {
    console.warn('Rate-limit admin no disponible (fail-open):', err);
    return { allowed: true };
  }
}

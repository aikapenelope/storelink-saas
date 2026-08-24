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
    limiter: Ratelimit.fixedWindow(parseRateLimitMax(process.env.RATE_LIMIT_CHECKOUT_PER_MIN), '60 s'),
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
 * import-csv 2/min · sync-sheets 4/min · orders status|pdf 30/min.
 */
export const ADMIN_ROUTE_LIMITS = {
  'import-csv': 2,
  'sync-sheets': 4,
  'order-status': 30,
  'order-pdf': 30,
} as const;

export type AdminRouteKey = keyof typeof ADMIN_ROUTE_LIMITS;

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
        limiter: Ratelimit.fixedWindow(ADMIN_ROUTE_LIMITS[route], '60 s'),
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

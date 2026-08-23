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

  const configured = Number(process.env.RATE_LIMIT_CHECKOUT_PER_MIN);
  const max = Number.isFinite(configured) && configured > 0 ? configured : 5;

  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.fixedWindow(max, '60 s'),
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

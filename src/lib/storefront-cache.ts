import { Redis } from '@upstash/redis';
import { revalidatePath } from 'next/cache';
import type { Payload } from 'payload';
import type { Product } from '@/payload-types';

/**
 * Caché distribuido Redis para productos del storefront.
 * Reduce carga BD en picos de tráfico complementando el ISR de Next.js.
 * 
 * Estrategia:
 * - TTL corto (3 min) para mantener frescura de datos
 * - Fallback a memoria si Redis no responde
 * - Invalidación automática con revalidatePath/Tag de Next.js
 */

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisClient = null;
    return null;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

const inMemoryCache = new Map<string, { data: Product[]; timestamp: number }>();
const MEMORY_TTL_MS = 2 * 60 * 1000; // 2 minutos en memoria

export interface ProductCacheResult {
  products: Product[];
  source: 'redis' | 'memory' | 'database';
}

export async function getCachedProducts(
  payload: Payload,
  tenantId: number
): Promise<ProductCacheResult> {
  const cacheKey = `storefront:products:${tenantId}`;
  const now = Date.now();

  // 1. Intentar caché Redis
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get<Product[]>(cacheKey);
      if (cached) {
        return { products: cached, source: 'redis' };
      }
    } catch (err) {
      console.warn('Redis cache error:', err);
    }
  }

  // 2. Fallback a caché en memoria
  const memCached = inMemoryCache.get(cacheKey);
  if (memCached && now - memCached.timestamp < MEMORY_TTL_MS) {
    return { products: memCached.data, source: 'memory' };
  }

  // 3. Fetch de BD
  const productsResult = await payload.find({
    collection: 'products',
    where: { tenant: { equals: tenantId } },
    limit: 500,
    depth: 1,
  });

  const products = productsResult.docs as Product[];

  // 4. Guardar en caché memoria
  inMemoryCache.set(cacheKey, { data: products, timestamp: now });

  // 5. Guardar en caché Redis (non-blocking)
  if (redis) {
    redis.set(cacheKey, products, { ex: 180 }).catch(() => {
      // Non-blocking: fallo de escritura no interrumpe el flujo
    });
  }

  return { products, source: 'database' };
}

export async function invalidateProductsCache(tenantId: number): Promise<void> {
  const cacheKey = `storefront:products:${tenantId}`;
  inMemoryCache.delete(cacheKey);

  const redis = getRedis();
  if (redis) {
    // Fix review Devin/Graphify (#64): AWAIT del borr distribuido. Antes era
    // fire-and-forget: un revalidatePath inmediato podía regenerar el HTML
    // leyendo el valor VIEJO de Redis antes de que el DEL aterrizara. El fallo
    // de Redis se tolera (el TTL de 180s es el límite de consistencia), pero la
    // invalidación exitosa debe completarse antes de devolver el control.
    try {
      await redis.del(cacheKey);
    } catch {
      // Non-blocking: si Redis no responde, el TTL acota la obsolescencia.
    }
  }
}

const POST_COMMIT_INVALIDATION_TIMEOUT_MS = 3000;
const POST_COMMIT_POLL_MS = 25;

/**
 * Pass de invalidación POST-commit (hallazgo Devin/Graphify #64): los hooks
 * afterChange/afterDelete de Payload corren DENTRO de la transacción (el
 * commit ocurre después de que los hooks resuelven). Si invalidamos solo ahí,
 * un render concurrente en la ventana [invalidate → commit] puede releer el
 * estado pre-commit de la BD y repoblar Redis/ISR con un producto borrado (o
 * stock viejo) durante todo el TTL.
 *
 * Esta función NO bloquea el hook: espera de forma no bloqueante a que la
 * transacción termine (commitTransaction/rollback borran req.transactionID —
 * utilities/commitTransaction.js) y entonces re-invalida + revalida el ISR.
 * Cierra la ventana de forma determinista. Tope de 3s para no dejar timers
 * huérfanos en serverless; si vence, invalida igual (idempotente).
 *
 * El caller SIEMPRE mantiene la invalidación inmediata (cubre el caso sin
 * transacción y el de esta pasada perdida si el runtime muere con el response).
 */
export function schedulePostCommitInvalidation(
  req: { transactionID?: unknown } | undefined,
  tenantId: number,
  tenantSlug?: string
): void {
  const perform = async (): Promise<void> => {
    await invalidateProductsCache(tenantId);
    if (tenantSlug) {
      try {
        revalidatePath(`/${tenantSlug}`);
      } catch {
        // Non-blocking
      }
    }
  };

  // Sin transacción activa: el write ya es durable (autocommit) → invalidar ya.
  if (!req || !req.transactionID) {
    void perform();
    return;
  }

  const deadline = Date.now() + POST_COMMIT_INVALIDATION_TIMEOUT_MS;
  const attempt = async (): Promise<void> => {
    if (req.transactionID && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POST_COMMIT_POLL_MS));
      return attempt();
    }
    await perform();
  };
  void attempt().catch(() => {
    // Best-effort: el TTL de Redis/ISR acota la obsolescencia residual.
  });
}

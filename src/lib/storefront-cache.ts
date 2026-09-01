import { Redis } from '@upstash/redis';
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

export function invalidateProductsCache(tenantId: number): void {
  const cacheKey = `storefront:products:${tenantId}`;
  inMemoryCache.delete(cacheKey);
  
  const redis = getRedis();
  if (redis) {
    redis.del(cacheKey).catch(() => {
      // Non-blocking
    });
  }
}

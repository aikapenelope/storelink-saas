import { Redis } from '@upstash/redis';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { Payload } from 'payload';
import type { Product } from '@/payload-types';
import type { ProductItem } from '@/components/storefront-client';
import { DEFAULT_PRODUCT_IMAGE_URL } from '@/lib/constants';
import { normalizeProductImageUrl } from '@/lib/image-hosts';
import { DEFAULT_CATALOG_LIMIT } from '@/lib/tenant-plans';

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

const inMemoryCache = new Map<string, { data: ProductItem[]; timestamp: number }>();
const MEMORY_TTL_MS = 2 * 60 * 1000; // 2 minutos en memoria

export interface ProductCacheResult {
  products: ProductItem[];
  source: 'redis' | 'memory' | 'database';
}

/**
 * Proyección LIVIANA del producto para storefront y caché (auditoría
 * 2026-09-05): se cachea exactamente lo que el catálogo renderiza (la forma
 * ProductItem con las URLs de imagen YA resueltas), no el doc completo de
 * Payload. Reduce el valor Redis 3-5× (upstash tiene tope por valor: un
 * catálogo de 1000+ productos como doc completo lo reventaba y el set
 * fallaba en silencio, dejando al tenant grande sin caché distribuido) y
 * de paso evita serializar dos veces el catálogo hacia el HTML del cliente.
 *
 * Cadena de resolución de imágenes (antes en [tenant]/page.tsx, misma
 * semántica): imageUrls → imageUrl (legacy) → images (relación Media con
 * depth 1) → DEFAULT_PRODUCT_IMAGE_URL.
 */
function toStorefrontProduct(prod: Product): ProductItem {
  const images = (() => {
    const urls: string[] = [];

    if (Array.isArray(prod.imageUrls)) {
      for (const u of prod.imageUrls) {
        if (typeof u === 'string' && u.trim().length > 0) {
          urls.push(normalizeProductImageUrl(u.trim()));
        }
      }
    }

    const legacyImageUrl = (prod as { imageUrl?: unknown }).imageUrl;
    if (urls.length === 0 && typeof legacyImageUrl === 'string' && legacyImageUrl.trim().length > 0) {
      urls.push(normalizeProductImageUrl(legacyImageUrl.trim()));
    }

    if (urls.length === 0 && Array.isArray(prod.images)) {
      for (const img of prod.images) {
        if (
          typeof img.image === 'object' &&
          img.image &&
          'url' in img.image &&
          typeof img.image.url === 'string' &&
          img.image.url.trim().length > 0
        ) {
          urls.push(normalizeProductImageUrl(img.image.url.trim()));
        }
      }
    }

    return urls.length > 0
      ? urls.map((url) => ({ url }))
      : [{ url: DEFAULT_PRODUCT_IMAGE_URL }];
  })();

  return {
    id: String(prod.id),
    sku: prod.sku || `SKU-${prod.id}`,
    title: prod.title,
    price: Number(prod.price) || 0,
    description: prod.description || '',
    category:
      prod.category && typeof prod.category === 'object'
        ? { id: String(prod.category.id), name: prod.category.name || 'General' }
        : undefined,
    stockStatus: (prod.stockStatus as 'in_stock' | 'out_of_stock') || 'in_stock',
    trackStock: Boolean(prod.trackStock),
    // Chequeo por tipo: `prod.stockQuantity ?` convertía el 0 (falsy) en
    // undefined y el catálogo mostraba "disponible" para agotados exactos.
    stockQuantity: typeof prod.stockQuantity === 'number' ? Number(prod.stockQuantity) : undefined,
    featured: Boolean(prod.featured),
    variants: Array.isArray(prod.variants)
      ? prod.variants.map((v) => ({
          name: v.name,
          sku: v.sku || undefined,
          price: Number(v.price) || 0,
          stockQuantity: typeof v.stockQuantity === 'number' ? Number(v.stockQuantity) : undefined,
          stockStatus: (v.stockStatus as 'in_stock' | 'out_of_stock') || 'in_stock',
        }))
      : [],
    modifiers: Array.isArray(prod.modifiers)
      ? prod.modifiers.map((m) => ({
          groupName: m.groupName,
          options: Array.isArray(m.options)
            ? m.options.map((opt) => ({
                name: opt.name,
                priceDelta: Number(opt.priceDelta) || 0,
              }))
            : [],
        }))
      : [],
    images,
  };
}

export async function getCachedProducts(
  payload: Payload,
  tenantId: number,
  /**
   * Límite de catálogo del plan del tenant (auditoría 2026-09-05, P1-1):
   * antes 500 hardcodeado — productos 501+ quedaban invisibles en silencio.
   * Default 1000 (estándar sin plan); el caller pasa el límite del plan.
   * sort determinista: el recorte (si lo hay) siempre corta los mismos
   * productos, no un subconjunto arbitrario por página.
   */
  catalogLimit: number = DEFAULT_CATALOG_LIMIT
): Promise<ProductCacheResult> {
  const cacheKey = `storefront:products:${tenantId}`;
  const now = Date.now();

  // 1. Intentar caché Redis
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get<ProductItem[]>(cacheKey);
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
    limit: catalogLimit,
    sort: '-createdAt',
    depth: 1,
  });

  const rawProducts = productsResult.docs as Product[];
  // Proyección liviana YA resuelta: es lo que se cachea en memoria y Redis
  // (ver toStorefrontProduct — misma semántica que mapeaba [tenant]/page.tsx).
  const products: ProductItem[] = rawProducts.map(toStorefrontProduct);

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

  const runAttempt = () => {
    attempt().catch(() => {
      // Best-effort: el TTL de Redis/ISR acota la obsolescencia residual.
    });
  };

  try {
    // Next.js 15: after() garantiza que la función Serverless en Vercel permanezca viva
    // hasta completar la invalidación post-commit en background sin congelar la CPU.
    after(async () => {
      await attempt().catch(() => {});
    });
  } catch {
    // Si se invoca fuera del contexto de una petición web (ej: CLI, tests unitarios),
    // se ejecuta la promesa flotante estándar como fallback resiliente.
    void runAttempt();
  }
}

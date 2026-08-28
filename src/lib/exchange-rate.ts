/**
 * Servicio de tasas de cambio en tiempo real (BCV, Binance P2P, Paralelo).
 * Las APIs solo reportan valores cuando responden (null si fallan); no hay
 * montos fijos de respaldo. La resolución del VES sigue la jerarquía:
 *   1. Tasa MANUAL del tenant (la que se configura desde Analíticas)
 *   2. Binance P2P (en vivo)
 *   3. Dólar paralelo (dolarapi) — fallback si Binance falla
 *   4. Ninguna → null → la app NO muestra Bs
 *
 * Sprint 1 (C1): las tres llamadas externas se ejecutan en PARALELO con
 * Promise.allSettled y timeout reducido a 5s. Antes eran secuenciales con
 * timeout de 10s c/u — worst case 30s bloqueando el checkout en Vercel (límite
 * 15s en Hobby). Ahora el worst case es 5s independientemente de cuántas fallen.
 */

import { Redis } from '@upstash/redis';

export interface ExchangeRateInfo {
  bcv: number | null;
  binance: number | null;
  paralelo: number | null;
  lastUpdated: string;
}

// Timeout reducido a 5s: con llamadas en paralelo el worst case pasa de 30s a
// 5s. Las APIs venezolanas (dolarapi, Binance P2P) responden bien bajo 2s en
// condiciones normales; 5s es margen suficiente para red lenta.
const EXTERNAL_TIMEOUT_MS = 5000;

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

let cachedRates: { data: ExchangeRateInfo; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/** Extrae el número válido de una respuesta de dolarapi (BCV o Paralelo). */
function parseDolarApiRate(data: unknown): number | null {
  const raw = (data as Record<string, unknown> | null)?.promedio
    ?? (data as Record<string, unknown> | null)?.price
    ?? (data as Record<string, unknown> | null)?.valor;
  const val = Number(raw);
  return val > 0 ? Number(val.toFixed(2)) : null;
}

/** Extrae la media de los primeros precios de Binance P2P. */
function parseBinanceRate(data: unknown): number | null {
  const typed = data as { data?: Array<{ adv?: { price?: string | number } }> } | null;
  if (!Array.isArray(typed?.data) || typed.data.length === 0) return null;
  const prices = typed.data
    .map((item) => Number(item?.adv?.price))
    .filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length === 0) return null;
  return Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2));
}

export async function getAllLiveExchangeRates(): Promise<ExchangeRateInfo> {
  const now = Date.now();

  // 1. Cache Redis compartido entre instancias serverless (Upstash)
  const redis = getRedis();
  if (redis) {
    try {
      const redisCached = await redis.get<ExchangeRateInfo>('storelink:rate:ves');
      if (redisCached && typeof redisCached === 'object' && redisCached.lastUpdated) {
        return redisCached;
      }
    } catch {
      // Fallback a memoria si Redis no responde
    }
  }

  // 2. Cache en memoria por instancia (evita doble fetch en llamadas concurrentes
  // dentro de la misma función cuando Redis no está disponible)
  if (cachedRates && now - cachedRates.timestamp < CACHE_TTL_MS) {
    return cachedRates.data;
  }

  // 3. Fetch en PARALELO — las tres peticiones arrancan simultáneamente.
  // Promise.allSettled garantiza que el resultado siempre llegue aunque alguna
  // falle o expire; cada una es independiente de las otras.
  const [bcvResult, parResult, binanceResult] = await Promise.allSettled([
    fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      next: { revalidate: 300 },
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
    }),
    fetch('https://ve.dolarapi.com/v1/dolares/paralelo', {
      next: { revalidate: 300 },
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
    }),
    fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      body: JSON.stringify({
        asset: 'USDT',
        fiat: 'VES',
        merchantCheck: false,
        page: 1,
        rows: 8,
        tradeType: 'BUY',
      }),
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
    }),
  ]);

  let bcvRate: number | null = null;
  let paraleloRate: number | null = null;
  let binanceRate: number | null = null;

  if (bcvResult.status === 'fulfilled' && bcvResult.value.ok) {
    try {
      bcvRate = parseDolarApiRate(await bcvResult.value.json());
    } catch {
      console.warn('Error parsing BCV rate response');
    }
  } else if (bcvResult.status === 'rejected') {
    console.warn('Error fetching BCV rate:', bcvResult.reason);
  }

  if (parResult.status === 'fulfilled' && parResult.value.ok) {
    try {
      paraleloRate = parseDolarApiRate(await parResult.value.json());
    } catch {
      console.warn('Error parsing Paralelo rate response');
    }
  } else if (parResult.status === 'rejected') {
    console.warn('Error fetching Paralelo rate:', parResult.reason);
  }

  if (binanceResult.status === 'fulfilled' && binanceResult.value.ok) {
    try {
      binanceRate = parseBinanceRate(await binanceResult.value.json());
    } catch {
      console.warn('Error parsing Binance rate response');
    }
  } else if (binanceResult.status === 'rejected') {
    console.warn('Error fetching Binance rate:', binanceResult.reason);
  }

  const result: ExchangeRateInfo = {
    bcv: bcvRate,
    binance: binanceRate,
    paralelo: paraleloRate,
    lastUpdated: new Date().toISOString(),
  };

  cachedRates = { data: result, timestamp: now };
  if (redis) {
    redis.set('storelink:rate:ves', result, { ex: 300 }).catch(() => {
      // Non-blocking: fallo de escritura en Redis no interrumpe el flujo
    });
  }
  return result;
}

export type VesRateResult = {
  rate: number | null;
  source: 'manual' | 'binance' | 'paralelo' | 'none';
};

/** Resolución del VES (jerarquía del producto):
 *  manual del tenant (configurada desde Analíticas) > Binance P2P en vivo >
 *  dólar paralelo (dolarapi) > ninguna (no se muestra Bs). */
export async function resolveExchangeRateVES(
  tenantDoc?: { branding?: { exchangeRateVES?: number | null } } | null
): Promise<VesRateResult> {
  const manual = Number(tenantDoc?.branding?.exchangeRateVES);
  if (Number.isFinite(manual) && manual > 0) {
    return { rate: manual, source: 'manual' };
  }

  const rates = await getAllLiveExchangeRates();
  if (rates.binance != null && rates.binance > 0) {
    return { rate: rates.binance, source: 'binance' };
  }
  if (rates.paralelo != null && rates.paralelo > 0) {
    return { rate: rates.paralelo, source: 'paralelo' };
  }
  return { rate: null, source: 'none' };
}

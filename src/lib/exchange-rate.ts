/**
 * Servicio de tasas de cambio en tiempo real (BCV, Binance P2P, Paralelo).
 * Las APIs solo reportan valores cuando responden (null si fallan); no hay
 * montos fijos de respaldo. La resolución del VES sigue la jerarquía:
 *   1. Tasa MANUAL del tenant (la que se configura desde Analíticas)
 *   2. Binance P2P (en vivo)
 *   3. Dólar paralelo (dolarapi) — fallback si Binance falla
 *   4. Ninguna → null → la app NO muestra Bs
 */

export interface ExchangeRateInfo {
  bcv: number | null;
  binance: number | null;
  paralelo: number | null;
  lastUpdated: string;
}

let cachedRates: { data: ExchangeRateInfo; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // Cache for 5 minutes

export async function getAllLiveExchangeRates(): Promise<ExchangeRateInfo> {
  const now = Date.now();

  if (cachedRates && now - cachedRates.timestamp < CACHE_TTL_MS) {
    return cachedRates.data;
  }

  let bcvRate: number | null = null;
  let paraleloRate: number | null = null;
  let binanceRate: number | null = null;

  // 1. Fetch BCV Official Rate
  try {
    const bcvRes = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      next: { revalidate: 300 },
      headers: { Accept: 'application/json' },
    });
    if (bcvRes.ok) {
      const data = await bcvRes.json();
      const val = Number(data.promedio || data.price || data.valor);
      if (val && val > 0) bcvRate = Number(val.toFixed(2));
    }
  } catch (err) {
    console.warn('Error fetching BCV rate:', err);
  }

  // 2. Fetch Paralelo Rate
  try {
    const parRes = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo', {
      next: { revalidate: 300 },
      headers: { Accept: 'application/json' },
    });
    if (parRes.ok) {
      const data = await parRes.json();
      const val = Number(data.promedio || data.price || data.valor);
      if (val && val > 0) paraleloRate = Number(val.toFixed(2));
    }
  } catch (err) {
    console.warn('Error fetching Paralelo rate:', err);
  }

  // 3. Fetch Binance P2P (USDT -> VES)
  try {
    const binanceRes = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
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
    });

    if (binanceRes.ok) {
      const binanceData = await binanceRes.json();
      if (Array.isArray(binanceData?.data) && binanceData.data.length > 0) {
        const prices = binanceData.data
          .map((item: any) => Number(item?.adv?.price))
          .filter((p: number) => !isNaN(p) && p > 0);

        if (prices.length > 0) {
          binanceRate = Number(
            (prices.reduce((a: number, b: number) => a + b, 0) / prices.length).toFixed(2)
          );
        }
      }
    }
  } catch (err) {
    console.warn('Error fetching Binance rate:', err);
  }

  const result: ExchangeRateInfo = {
    bcv: bcvRate,
    binance: binanceRate,
    paralelo: paraleloRate,
    lastUpdated: new Date().toISOString(),
  };

  cachedRates = { data: result, timestamp: now };
  return result;
}

/** Lanza si la API no respondió (sin montos fijos de respaldo). */
export async function getLiveExchangeRate(
  provider: 'binance' | 'paralelo' | 'bcv' = 'binance'
): Promise<number> {
  const rates = await getAllLiveExchangeRates();
  const value = provider === 'bcv' ? rates.bcv : provider === 'paralelo' ? rates.paralelo : rates.binance;
  if (value == null || value <= 0) {
    throw new Error(`Exchange rate "${provider}" unavailable`);
  }
  return value;
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
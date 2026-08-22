/**
 * Real-Time Exchange Rate Service (BCV, Binance P2P, Paralelo)
 * Direct official Binance P2P Order Book integration with DolarApi fallback.
 */

export interface ExchangeRateInfo {
  bcv: number;
  binance: number;
  paralelo: number;
  lastUpdated: string;
}

let cachedRates: { data: ExchangeRateInfo; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // Cache for 5 minutes

export async function getAllLiveExchangeRates(): Promise<ExchangeRateInfo> {
  const now = Date.now();

  if (cachedRates && now - cachedRates.timestamp < CACHE_TTL_MS) {
    return cachedRates.data;
  }

  let bcvRate = 780.0;
  let paraleloRate = 900.0;
  let binanceRate = 900.0;

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
    } else {
      binanceRate = paraleloRate;
    }
  } catch {
    binanceRate = paraleloRate;
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

export async function getLiveExchangeRate(provider: 'binance' | 'paralelo' | 'bcv' = 'binance'): Promise<number> {
  const rates = await getAllLiveExchangeRates();
  if (provider === 'bcv') return rates.bcv;
  if (provider === 'paralelo') return rates.paralelo;
  return rates.binance;
}

/** Resolución de la tasa VES (bolívares): SOLO la tasa manual del tenant.
 *  La moneda del sistema es USD (precios desde Google Sheets); el VES es una
 *  conversión opcional de display. Sin tasa manual → null → la app NO muestra
 *  Bs (no hay fallback a APIs ni montos fijos). */
export async function resolveExchangeRateVES(
  tenantDoc?: { branding?: { exchangeRateVES?: number | null } } | null
): Promise<number | null> {
  const custom = Number(tenantDoc?.branding?.exchangeRateVES);
  return Number.isFinite(custom) && custom > 0 ? custom : null;
}

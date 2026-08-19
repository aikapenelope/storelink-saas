/**
 * Real-Time Binance P2P (USDT/VES) & Venezuelan Market Rate Fetcher
 * Direct official Binance P2P Order Book integration with DolarApi fallback and 15-min in-memory caching.
 */

let cachedRate: { value: number; timestamp: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // Cache for 10 minutes

export async function getLiveExchangeRate(provider: 'binance' | 'paralelo' | 'bcv' = 'binance'): Promise<number> {
  const now = Date.now();

  // Return memory cached rate if fresh
  if (cachedRate && now - cachedRate.timestamp < CACHE_TTL_MS) {
    return cachedRate.value;
  }

  // 1. Direct Official Binance P2P C2C Orderbook (USDT -> VES)
  if (provider === 'binance' || !provider) {
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
        next: { revalidate: 600 },
      });

      if (binanceRes.ok) {
        const binanceData = await binanceRes.json();
        if (Array.isArray(binanceData?.data) && binanceData.data.length > 0) {
          const prices = binanceData.data
            .map((item: any) => Number(item?.adv?.price))
            .filter((p: number) => !isNaN(p) && p > 0);

          if (prices.length > 0) {
            const avgBinanceRate = Number(
              (prices.reduce((a: number, b: number) => a + b, 0) / prices.length).toFixed(2)
            );
            cachedRate = { value: avgBinanceRate, timestamp: now };
            return avgBinanceRate;
          }
        }
      }
    } catch (binanceErr) {
      console.warn('Binance P2P direct query failed, trying secondary provider...', binanceErr);
    }
  }

  // 2. Secondary Provider: DolarApi Paralelo (Market Rate)
  try {
    const url =
      provider === 'bcv'
        ? 'https://ve.dolarapi.com/v1/dolares/oficial'
        : 'https://ve.dolarapi.com/v1/dolares/paralelo';

    const res = await fetch(url, {
      next: { revalidate: 600 },
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      const rate = Number(data.promedio || data.price || data.valor);
      if (rate && rate > 0) {
        const cleanRate = Number(rate.toFixed(2));
        cachedRate = { value: cleanRate, timestamp: now };
        return cleanRate;
      }
    }
  } catch (err) {
    console.warn('DolarApi fallback failed', err);
  }

  // 3. Fallback default rate if all networks fail
  return cachedRate?.value || 900.0;
}

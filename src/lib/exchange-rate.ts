/**
 * Real-time Venezuelan Exchange Rate Fetcher
 * Supports Binance P2P, Paralelo, and BCV with automatic caching and fallback.
 */

let cachedRate: { value: number; timestamp: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // Cache for 15 minutes to avoid rate limits

export async function getLiveExchangeRate(provider: 'binance' | 'paralelo' | 'bcv' = 'paralelo'): Promise<number> {
  const now = Date.now();

  // Return memory cached rate if fresh
  if (cachedRate && now - cachedRate.timestamp < CACHE_TTL_MS) {
    return cachedRate.value;
  }

  try {
    // 1. Try DolarApi (fastest, high availability)
    const url =
      provider === 'bcv'
        ? 'https://ve.dolarapi.com/v1/dolares/bcv'
        : 'https://ve.dolarapi.com/v1/dolares/paralelo';

    const res = await fetch(url, {
      next: { revalidate: 900 },
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      const rate = Number(data.promedio || data.price || data.valor);
      if (rate && rate > 0) {
        cachedRate = { value: rate, timestamp: now };
        return rate;
      }
    }
  } catch (err) {
    console.warn('Could not fetch live rate from DolarApi, trying fallback...', err);
  }

  // 2. Try Secondary Public Provider (PyDolarVenezuela Binance)
  try {
    const res2 = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=binance', {
      next: { revalidate: 900 },
    });
    if (res2.ok) {
      const data2 = await res2.json();
      const rate2 = Number(data2?.monitors?.binance?.price);
      if (rate2 && rate2 > 0) {
        cachedRate = { value: rate2, timestamp: now };
        return rate2;
      }
    }
  } catch (err2) {
    console.warn('Secondary rate provider failed, using fallback rate', err2);
  }

  // 3. Fallback default rate if internet/APIs fail
  return cachedRate?.value || 56.5;
}

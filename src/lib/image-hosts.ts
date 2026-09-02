/**
 * Whitelist ÚNICA de hosts permitidos para imágenes de producto.
 *
 * Por qué existe (auditoría final 2026-09-01, CRÍTICO): antes la validación de
 * `imageUrls` solo exigía protocolo http/https. Cualquier host pasaba y llegaba
 * a `next/image` (SafeProductImage), que LANZA una excepción en render cuando
 * el host no está en `images.remotePatterns` de next.config — ese throw no lo
 * captura el onError del componente (no es un error de carga, es un fallo de
 * render), así que UNA sola URL con host no listado (p.ej. importada desde
 * Google Sheets) tumbaba el SSR de la tienda entera (500).
 *
 * Fuente de verdad compartida entre:
 *  - next.config.ts (images.remotePatterns)  → permite el host en next/image
 *  - Products.ts (validate de imageUrls)      → rechaza en el admin
 *  - catalog-import.ts (sync Sheets/CSV)      → descarta en import masivo
 *  - safe-product-image.tsx                   → defensa en profundidad en render
 *
 * Cada entrada es un SUFIJO de host: coincide el host exacto o cualquier
 * subdominio (ej. 'supabase.co' permite 'xyz.supabase.co').
 */
export const ALLOWED_IMAGE_HOST_SUFFIXES = [
  'images.unsplash.com',
  'supabase.co',
  'r2.cloudflarestorage.com',
  'vercel.app',
] as const;

/** true si el hostname coincide con la whitelist (exacto o subdominio). */
export function isAllowedImageHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_IMAGE_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

/** true si la URL es http(s) y su host está en la whitelist. */
export function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return isAllowedImageHostname(parsed.hostname);
  } catch {
    return false;
  }
}

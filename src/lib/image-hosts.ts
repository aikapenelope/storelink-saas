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
 * Reglas de matching (alineadas 1:1 con los remotePatterns que genera
 * next.config.ts y con la semántica REAL de Next.js, que valida el hostname
 * con picomatch — `*` cruza puntos en un hostname):
 *  - SOLO https (los patterns son https; un http aprobado aquí crashearía).
 *  - Host EXACTO igual al sufijo (p.ej. `supabase.co`) — next.config emite
 *    también un pattern exacto para cada sufijo.
 *  - Cualquier subdominio a cualquier nivel (`a.b.supabase.co`) — cubierto por
 *    el pattern `*.supabase.co` (picomatch `*` no se detiene en los puntos).
 *
 * tests/unit/image-hosts.test.ts verifica esta equivalencia contra
 * `hasRemoteMatch` de Next para TODAS las URLs que este módulo acepta.
 */
export const ALLOWED_IMAGE_HOST_SUFFIXES = [
  'images.unsplash.com',
  'supabase.co',
  'r2.cloudflarestorage.com',
  'vercel.app',
] as const;

/** true si el hostname está cubierto por la whitelist (exacto o subdominio). */
export function isAllowedImageHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_IMAGE_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

/**
 * true si la URL es https y su host está cubierto por la whitelist.
 * http se rechaza DELIBERADAMENTE: los remotePatterns de next.config son
 * https-only, y una URL http aprobada aquí haría que next/image lanzara en
 * render (crash del storefront) además de ser contenido alterable en tránsito.
 */
export function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return isAllowedImageHostname(parsed.hostname);
  } catch {
    return false;
  }
}

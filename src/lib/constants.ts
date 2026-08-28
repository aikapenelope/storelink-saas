/**
 * Constantes globales de la aplicación StoreLink SaaS
 */

/**
 * Imagen de fallback predeterminada para productos sin fotografía
 */
export const DEFAULT_PRODUCT_IMAGE_URL =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

/**
 * Límite máximo de artículos por pedido en checkout (anti-DoS)
 */
export const MAX_CHECKOUT_ITEMS = 30;

/**
 * Slugs reservados que NUNCA puede usar un tenant: son rutas estáticas
 * reales de la app (colisionan con `src/app/(app)/[tenant]/page.tsx` porque
 * Next.js siempre prioriza una ruta literal sobre el segmento dinámico
 * `[tenant]`) o archivos que el navegador/crawlers piden por convención.
 *
 * Única fuente de verdad: antes esta lista solo vivía duplicada dentro de
 * `[tenant]/page.tsx` y no incluía "templates" (ruta real de
 * `src/app/(app)/templates/page.tsx`) — un tenant con ese slug quedaba
 * inalcanzable en silencio, sin ningún error. Ahora también la usa el
 * `validate` del campo `slug` en `Tenants.ts` para avisar en el admin ANTES
 * de guardar, y si se agrega una ruta estática nueva basta actualizar aquí.
 */
export const RESERVED_TENANT_SLUGS = new Set([
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'apple-touch-icon.png',
  'apple-touch-icon-precomposed.png',
  'manifest.json',
  'admin',
  'api',
  // Rutas estáticas reales de src/app/(app)/ (nunca un tenant real)
  'demo',
  'templates',
]);

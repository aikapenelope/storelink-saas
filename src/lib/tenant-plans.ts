/**
 * Planes de capacidad del catálogo por tenant (auditoría 2026-09-05, P1-1).
 *
 * El límite de productos por tienda ahora es configurable por super-admin
 * desde el campo `plan` de Tenants. Sin plan asignado (null/undefined) la
 * tienda usa el límite estándar global. Los números viven SOLO aquí:
 * el campo `plan` del admin es la elección, no la cifra.
 *
 * Consumidores:
 *  - src/lib/storefront-cache.ts → `getCachedProducts` (límite de visualización)
 *  - src/jobs/catalog-import.ts  → puerta de cuota en la ingesta (bloquea
 *    CREACIONES nuevas al agotar el cupo; los updates de SKUs existentes
 *    nunca consumen cupo, así un re-sync del catálogo completo sigue válido)
 *  - src/app/api/[tenant]/import-csv y sync-sheets → el mensaje de respuesta
 *    informa el límite activo del plan
 */

export const DEFAULT_CATALOG_LIMIT = 1000;

export const PLAN_CATALOG_LIMITS = {
  basico: 500,
  pro: 2000,
} as const;

export type TenantPlan = keyof typeof PLAN_CATALOG_LIMITS;

/** Límite de catálogo activo para un tenant según su plan. */
export function getCatalogLimit(plan?: string | null): number {
  if (plan === 'basico') return PLAN_CATALOG_LIMITS.basico;
  if (plan === 'pro') return PLAN_CATALOG_LIMITS.pro;
  return DEFAULT_CATALOG_LIMIT;
}

/** Etiqueta humanizada del plan (para mensajes de la API y el admin). */
export function describeCatalogLimit(plan?: string | null): string {
  return `límite del plan: ${getCatalogLimit(plan)} productos`;
}

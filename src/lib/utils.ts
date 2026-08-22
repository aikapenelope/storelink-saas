import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency,
  }).format(price);
}

/** Type-safe helper to read the custom `role` field from Payload's User object */
export function getUserRole(user: unknown): 'super-admin' | 'tenant-admin' | undefined {
  if (user && typeof user === 'object' && 'role' in user) {
    const role = (user as { role: unknown }).role;
    if (role === 'super-admin' || role === 'tenant-admin') return role;
  }
  return undefined;
}

/**
 * Extrae los IDs de tenants asignados a un usuario desde el array `tenants`
 * que inyecta @payloadcms/plugin-multi-tenant en la colección users
 * (https://payloadcms.com/docs/plugins/multi-tenant).
 * Cada fila del array puede traer el tenant poblado (objeto) o solo el ID.
 */
export function getUserTenantIds(user: unknown): Array<number | string> {
  if (!user || typeof user !== 'object' || !('tenants' in user) || !Array.isArray((user as { tenants: unknown }).tenants)) {
    return [];
  }
  const rows = (user as { tenants: Array<Record<string, unknown>> }).tenants;
  const ids: Array<number | string> = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const t = row['tenant'];
    if (t && typeof t === 'object' && 'id' in t) {
      ids.push((t as { id: number | string }).id);
    } else if (typeof t === 'number' || typeof t === 'string') {
      ids.push(t);
    }
  }
  return ids;
}

/** Patrón oficial de acceso multi-tenant (igual que Tenants.ts): un usuario
 *  autenticado solo opera si tiene tenants asignados, salvo super-admin. */
export function isSuperAdmin(user: unknown): boolean {
  return getUserRole(user) === 'super-admin';
}

export function hasTenantAccess(user: unknown): boolean {
  return isSuperAdmin(user) || getUserTenantIds(user).length > 0;
}

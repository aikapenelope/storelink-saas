import { APIError, type CollectionBeforeChangeHook } from 'payload';
import { getUserRole, getUserTenantIds } from '@/lib/utils';

/**
 * Guard de escritura cross-tenant (audit A1, plan v2 R1).
 *
 * El plugin multi-tenant aplica sus constraints como objetos Where
 * (getTenantAccess), que filtran read/update/delete pero NO create: en
 * create no hay documento que filtrar, así que un tenant-admin podía crear
 * documentos asignando un tenant ajeno en el payload. Este hook de
 * colección corre ANTES de la validación de campos (orden oficial en
 * packages/payload/src/collections/operations/create.ts) y rechaza con
 * APIError(403), el patrón oficial de docs/hooks/overview.mdx.
 *
 * Reglas:
 * - super-admin pasa siempre (equivalente a userHasAccessToAllTenants).
 * - Sin usuario → pasa: solo llegan aquí operaciones internas de confianza
 *   (checkout/jobs con overrideAccess:true); el acceso público anónimo ya lo
 *   bloquea la capa de access de cada colección.
 * - Con `tenant` explícito en data (id plano u objeto poblado): debe estar
 *   entre los tenants del usuario; si no → 403.
 * - SIN `tenant` explícito → pasa: el defaultValue oficial del campo tenant
 *   del plugin auto-asigna desde cookie o el primer tenant del usuario
 *   (packages/plugin-multi-tenant/src/fields/tenantField/index.ts).
 */

type TenantValue = number | string | { id?: number | string } | null | undefined;

/** Normaliza el valor del campo tenant (id plano u objeto poblado) a id. */
export function tenantIdFromValue(value: TenantValue): number | string | null {
  if (value == null) return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'object' && 'id' in value && value.id != null) return value.id;
  return null;
}

/** Helper puro e inyectable (testeable sin runtime de Payload):
 *  true = escritura permitida. Los ids se comparan como string para tolerar
 *  el valor poblado (objeto) o plano, igual que lib/utils.assertTenantAccess. */
export function assertTenantMembership(user: unknown, tenantValue: TenantValue): boolean {
  if (!user) return true;
  if (getUserRole(user) === 'super-admin') return true;

  const requested = tenantIdFromValue(tenantValue);
  if (requested == null) return true;

  return getUserTenantIds(user).some((id) => String(id) === String(requested));
}

/** Factory reutilizable (skill ACCESS-CONTROL-ADVANCED#factory-functions):
 *  una instancia por colección, aplicada en hooks.beforeChange. */
export const createTenantWriteGuard = (): CollectionBeforeChangeHook =>
  async ({ data, req }) => {
    const tenantValue = (data as Record<string, unknown> | undefined)?.tenant as TenantValue;
    if (!assertTenantMembership(req.user, tenantValue)) {
      throw new APIError('No tienes permiso para escribir en esta tienda.', 403);
    }
    return data;
  };

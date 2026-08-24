import { getPayload } from 'payload';
import config from '@/payload.config';
import type { Tenant } from '@/payload-types';

/** Resuelve un tenant por slug (null si no existe). Punto único de consulta
 *  para storefront y metadata; la Local API corre server-side con
 *  overrideAccess por defecto (lectura pública intencional del catálogo). */
export async function getTenantBySlug(tenantSlug: string): Promise<Tenant | null> {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: tenantSlug } },
    limit: 1,
  });
  return result.docs[0] ?? null;
}

import React from 'react';
import { getPayload } from 'payload';
import config from '@payload-config';
import { headers } from 'next/headers';
import { PackageX } from 'lucide-react';
import { getUserTenantIds } from '@/lib/utils';
import { getCatalogLimit } from '@/lib/tenant-plans';
import type { User } from '@/payload-types';

/**
 * PR 6b (SPEC-20260907-6, auditoría B3): banner en el admin cuando el
 * catálogo del tenant alcanzó el límite de su plan. Hasta ahora un
 * downgrade de plan volvía INVISIBLES los productos excedentes (el caché
 * del storefront corta en getCatalogLimit) sin ninguna señal al comercio
 * — ni en el admin ni al crear a mano.
 *
 * Server Component en admin.components.beforeDashboard (mismo patrón que
 * StoreUrlBanner): corre con la sesión del request, sin fetches del cliente.
 * Solo se renderiza cuando el cupo está AGOTADO (count >= límite); con
 * margen disponible no aparece (cero ruido).
 */
export async function CatalogLimitBanner() {
  try {
    const payload = await getPayload({ config });
    const headersList = await headers();
    const { user } = await payload.auth({ headers: headersList });
    if (!user) return null;

    const tenantIds = getUserTenantIds(user as User);
    if (tenantIds.length === 0) return null;

    // Banner solo para el primer tenant del usuario (misma convención que
    // StoreUrlBanner: el admin opera sobre "su" tienda).
    const tenantDoc = (await payload.findByID({
      collection: 'tenants',
      id: tenantIds[0] as number,
      depth: 0,
    }).catch(() => null)) as { plan?: string | null } | null;
    if (!tenantDoc) return null;

    const limit = getCatalogLimit(tenantDoc.plan);
    const countRes = await payload.count({
      collection: 'products',
      where: { tenant: { equals: tenantIds[0] } },
    });

    if (countRes.totalDocs < limit) return null;

    return (
      <div className="w-full my-2 p-4 bg-amber-950/60 border border-amber-700 flex items-start sm:items-center justify-between gap-3 font-sans text-amber-100 shadow-xl rounded-none isolate box-border">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-amber-900 border border-amber-600 flex items-center justify-center text-amber-200 shrink-0 rounded-none">
            <PackageX className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider leading-none">
              Límite de catálogo alcanzado
            </div>
            <div className="text-xs sm:text-sm font-medium text-amber-100/90 mt-1 leading-snug">
              Esta tienda tiene {countRes.totalDocs} productos y su plan admite hasta {limit}.
              Los productos nuevos se rechazarán y el storefront muestra solo los primeros {limit}.
              Elimina productos desactualizados o contacta al equipo de Flow Martes para ampliar el plan.
            </div>
          </div>
        </div>
      </div>
    );
  } catch {
    // Best-effort: el banner jamás debe romper el dashboard.
    return null;
  }
}

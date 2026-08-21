import React from 'react';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { headers } from 'next/headers';
import { Store, ExternalLink, BarChart3 } from 'lucide-react';

export async function StoreUrlBanner() {
  try {
    const payload = await getPayload({ config });
    const headersList = await headers();
    const { user } = await payload.auth({ headers: headersList });

    if (!user) return null;

    const isSuperAdmin = (user as any).role === 'super-admin';
    let tenantSlug: string | null = null;
    let tenantName = 'Mi Tienda';

    if ((user as any)?.tenants && Array.isArray((user as any).tenants) && (user as any).tenants.length > 0) {
      const firstTenantRef = (user as any).tenants[0].tenant;
      const t = typeof firstTenantRef === 'object' && firstTenantRef !== null ? firstTenantRef : null;
      if (t) {
        tenantSlug = t.slug || null;
        tenantName = t.name || tenantName;
      } else if (firstTenantRef) {
        const doc = await payload.findByID({ collection: 'tenants', id: firstTenantRef }).catch(() => null);
        if (doc) {
          tenantSlug = doc.slug || null;
          tenantName = doc.name || tenantName;
        }
      }
    }

    if (!tenantSlug && isSuperAdmin) {
      const allTenants = await payload.find({ collection: 'tenants', limit: 1 });
      if (allTenants.docs.length > 0) {
        tenantSlug = allTenants.docs[0].slug;
        tenantName = allTenants.docs[0].name;
      }
    }

    if (!tenantSlug) {
      if (isSuperAdmin) {
        return (
          <div className="w-full mb-6 p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between gap-4 font-sans text-zinc-100 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Super Admin · Plataforma Global</div>
                <div className="text-sm font-medium text-zinc-200 mt-0.5">
                  Crea tu primera tienda en la colección <strong>Tenants</strong>.
                </div>
              </div>
            </div>
          </div>
        );
      }
      return null;
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://flow.martes.app';
    const storeUrl = `${siteUrl}/${tenantSlug}`;

    return (
      <div className="w-full mb-6 p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-zinc-100 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Tienda Activa: <span className="text-white">{tenantName}</span>
            </div>
            <div className="text-sm font-medium text-zinc-300 flex items-center gap-1.5 mt-0.5">
              <span className="text-zinc-400">URL Pública:</span>
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-zinc-300 font-semibold underline inline-flex items-center gap-1"
              >
                flow.martes.app/{tenantSlug}
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <a
            href="/admin/analytics"
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold rounded-xl border border-zinc-700 transition inline-flex items-center gap-1.5"
          >
            <BarChart3 className="w-4 h-4 text-zinc-400" />
            <span>Ver Analíticas</span>
          </a>
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 shadow-lg"
          >
            <span>Abrir Tienda</span>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-950" />
          </a>
        </div>
      </div>
    );
  } catch (error) {
    return null;
  }
}

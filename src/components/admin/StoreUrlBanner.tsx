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
          <div className="w-full mb-6 p-4 bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-4 font-sans text-zinc-100 shadow-xl rounded-none">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0 rounded-none">
                <Store className="w-4 h-4" />
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
      <div className="w-full mb-6 p-4 bg-black border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-zinc-100 shadow-2xl rounded-none">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0 rounded-none">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Tienda Activa: <span className="text-white font-bold">{tenantName}</span>
            </div>
            <div className="text-xs sm:text-sm font-medium text-zinc-300 flex items-center gap-1.5 mt-0.5">
              <span className="text-zinc-400">URL Pública:</span>
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:underline font-mono inline-flex items-center gap-1"
              >
                flow.martes.app/{tenantSlug}
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <a
            href="/admin/analytics"
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold border border-zinc-700 transition inline-flex items-center gap-1.5 rounded-none uppercase tracking-wider"
          >
            <BarChart3 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Dashboard</span>
          </a>
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white hover:bg-zinc-200 text-black text-xs font-bold transition inline-flex items-center gap-1.5 shadow-lg rounded-none uppercase tracking-wider"
          >
            <span>Abrir Tienda</span>
            <ExternalLink className="w-3.5 h-3.5 text-black" />
          </a>
        </div>
      </div>
    );
  } catch (error) {
    return null;
  }
}

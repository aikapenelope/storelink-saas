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

    const isSuperAdmin = user.role === 'super-admin';
    let tenantSlug = 'don-luigi';
    let tenantName = 'Don Luigi';

    if (!isSuperAdmin) {
      const userDoc: any = await payload.findByID({
        collection: 'users',
        id: user.id,
        depth: 1,
      });

      if (userDoc?.tenants && userDoc.tenants.length > 0) {
        const firstTenantRef = userDoc.tenants[0];
        const t = typeof firstTenantRef.tenant === 'object' ? firstTenantRef.tenant : null;
        if (t) {
          tenantSlug = t.slug || tenantSlug;
          tenantName = t.name || tenantName;
        }
      }
    }

    return (
      <div className="w-full mb-6 p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-slate-100 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Tienda Activa: {tenantName}</div>
            <div className="text-sm font-medium text-slate-300 flex items-center gap-1.5 mt-0.5">
              <span>URL Pública:</span>
              <a
                href={`https://flow.martes.app/${tenantSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 font-semibold underline inline-flex items-center gap-1"
              >
                flow.martes.app/{tenantSlug}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <a
            href="/admin/analytics"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition inline-flex items-center gap-1.5"
          >
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <span>Ver Analíticas Completas</span>
          </a>
          <a
            href={`https://flow.martes.app/${tenantSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
          >
            <span>Abrir Tienda</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  } catch (error) {
    return null;
  }
}

import React from 'react';
import Link from 'next/link';
import { getPayload } from 'payload';
import config from '@payload-config';
import { headers } from 'next/headers';
import { Store, ExternalLink, BarChart3 } from 'lucide-react';
import { isSuperAdmin, getUserTenantIds } from '@/lib/utils';
import type { User, Tenant } from '@/payload-types';

export async function StoreUrlBanner() {
  try {
    const payload = await getPayload({ config });
    const headersList = await headers();
    const { user } = await payload.auth({ headers: headersList });

    if (!user) return null;

    const typedUser = user as User;
    const isSuperAdminUser = isSuperAdmin(typedUser);
    const tenantIds = getUserTenantIds(typedUser);
    let tenantSlug: string | null = null;
    let tenantName = 'Mi Tienda';

    if (tenantIds.length > 0) {
      const doc = (await payload.findByID({
        collection: 'tenants',
        id: tenantIds[0] as number,
      }).catch(() => null)) as Tenant | null;

      if (doc) {
        tenantSlug = doc.slug || null;
        tenantName = doc.name || tenantName;
      }
    }

    if (!tenantSlug && isSuperAdminUser) {
      const allTenants = await payload.find({ collection: 'tenants', limit: 1 });
      if (allTenants.docs.length > 0) {
        const first = allTenants.docs[0] as Tenant;
        tenantSlug = first.slug || null;
        tenantName = first.name || tenantName;
      }
    }

    if (!tenantSlug) {
      if (isSuperAdminUser) {
        return (
          <div className="w-full my-4 p-4 bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-4 font-sans text-zinc-100 shadow-xl rounded-none isolate box-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0 rounded-none">
                <Store className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider leading-none">Super Admin · Plataforma Global</div>
                <div className="text-sm font-medium text-zinc-200 mt-1 leading-tight truncate">
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
      <div className="w-full my-4 p-4 bg-black border border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 font-sans text-zinc-100 shadow-2xl rounded-none isolate box-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0 rounded-none">
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider leading-none">
              Tienda Activa: <span className="text-white font-bold">{tenantName}</span>
            </div>
            <div className="text-xs sm:text-sm font-medium text-zinc-300 flex items-center gap-1.5 mt-1 leading-tight flex-wrap">
              <span className="text-zinc-400 shrink-0">URL Pública:</span>
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:underline font-mono inline-flex items-center gap-1 shrink-0"
              >
                flow.martes.app/{tenantSlug}
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end shrink-0">
          <Link
            href="/admin/analytics"
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold border border-zinc-700 transition inline-flex items-center gap-1.5 rounded-none uppercase tracking-wider shrink-0 leading-none"
          >
            <BarChart3 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Dashboard</span>
          </Link>
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white hover:bg-zinc-200 text-black text-xs font-bold transition inline-flex items-center gap-1.5 shadow-lg rounded-none uppercase tracking-wider shrink-0 leading-none"
          >
            <span>Abrir Tienda</span>
            <ExternalLink className="w-3.5 h-3.5 text-black" />
          </a>
        </div>
      </div>
    );
  } catch {
    return null;
  }
}

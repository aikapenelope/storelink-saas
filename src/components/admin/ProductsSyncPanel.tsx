import React from 'react';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { headers } from 'next/headers';
import { GoogleSheetsSyncWidget } from './GoogleSheetsSyncWidget';

export async function ProductsSyncPanel() {
  try {
    const payload = await getPayload({ config });
    const headersList = await headers();
    const { user } = await payload.auth({ headers: headersList });

    if (!user) return null;

    const isSuperAdmin = (user as any).role === 'super-admin';
    let tenantSlug: string | null = null;
    let tenantName = 'Mi Tienda';

    if ((user as any)?.tenants && Array.isArray((user as any).tenants) && (user as any).tenants.length > 0) {
      const rawTenant = (user as any).tenants[0].tenant;
      const tenantDoc = typeof rawTenant === 'object' && rawTenant !== null ? rawTenant : null;
      if (tenantDoc) {
        tenantSlug = tenantDoc.slug;
        tenantName = tenantDoc.name || 'Mi Tienda';
      } else if (rawTenant) {
        const doc = await payload.findByID({ collection: 'tenants', id: rawTenant }).catch(() => null);
        if (doc) {
          tenantSlug = doc.slug;
          tenantName = doc.name || 'Mi Tienda';
        }
      }
    }

    if (!tenantSlug && isSuperAdmin) {
      const firstTenant = await payload.find({ collection: 'tenants', limit: 1 });
      if (firstTenant.docs.length > 0) {
        tenantSlug = firstTenant.docs[0].slug;
        tenantName = firstTenant.docs[0].name || 'Tienda Principal';
      }
    }

    if (!tenantSlug) return null;

    return (
      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5 shadow-2xl text-zinc-100 font-sans">
        <GoogleSheetsSyncWidget tenantSlug={tenantSlug} tenantName={tenantName} />
      </div>
    );
  } catch (error) {
    return null;
  }
}

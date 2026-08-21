import React from 'react';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { headers } from 'next/headers';
import { GoogleSheetsSyncWidget } from './GoogleSheetsSyncWidget';
import {
  DollarSign,
  ShoppingBag,
  Users as UsersIcon,
  Crown,
  ExternalLink,
  PlusCircle,
  BarChart3,
  RefreshCw,
  Store,
  CheckCircle2,
  Clock,
  Flame,
} from 'lucide-react';

export async function AnalyticsView() {
  try {
    const payload = await getPayload({ config });
    const headersList = await headers();
    const { user } = await payload.auth({ headers: headersList });

    if (!user) {
      return (
        <div className="p-8 text-center">
          <p className="text-slate-400">Debes iniciar sesión para ver las analíticas.</p>
        </div>
      );
    }

    const isSuperAdmin = user.role === 'super-admin';

    // Find active tenant for this user
    let activeTenant: any = null;

    if (!isSuperAdmin) {
      const userDoc: any = await payload.findByID({
        collection: 'users',
        id: user.id,
        depth: 1,
      });

      if (userDoc?.tenants && userDoc.tenants.length > 0) {
        const firstTenantRef = userDoc.tenants[0];
        activeTenant = typeof firstTenantRef.tenant === 'object' ? firstTenantRef.tenant : null;
      }
    }

    // Fetch tenant-specific orders and metrics
    const tenantFilter: any = activeTenant?.id ? { tenant: { equals: activeTenant.id } } : undefined;

    const [ordersRes, productsRes] = await Promise.all([
      payload.find({
        collection: 'orders',
        ...(tenantFilter ? { where: tenantFilter } : {}),
        limit: 500,
      }),
      payload.find({
        collection: 'products',
        ...(tenantFilter ? { where: tenantFilter } : {}),
        limit: 100,
      }),
    ]);

    const orders = ordersRes.docs || [];
    const totalOrders = orders.length;

    const totalRevenueUSD = orders.reduce(
      (acc, o: any) => acc + (Number(o.totalAmount || o.total) || 0),
      0
    );

    const pendingOrders = orders.filter(
      (o: any) => o.status === 'pending' || o.status === 'processing'
    ).length;

    const tenantSlug = activeTenant?.slug || 'don-luigi';
    const tenantName = activeTenant?.name || (isSuperAdmin ? 'Plataforma Global' : 'Mi Tienda');

    return (
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans text-slate-100">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-2">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analíticas y Rendimiento de Ventas</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">{tenantName}</h1>
            <p className="text-xs text-slate-400 mt-1">
              Catálogo activo en:{' '}
              <a
                href={`https://flow.martes.app/${tenantSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 font-semibold underline inline-flex items-center gap-1"
              >
                flow.martes.app/{tenantSlug}
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          <a
            href={`https://flow.martes.app/${tenantSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition inline-flex items-center gap-2 self-start md:self-center shadow-lg shadow-emerald-500/20"
          >
            <Store className="w-4 h-4" />
            <span>Ver Tienda PWA en Vivo</span>
          </a>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Ventas Totales</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white">${totalRevenueUSD.toFixed(2)}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">Acumulado en dólares ($ USD)</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Órdenes Generadas</span>
              <ShoppingBag className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-white">{totalOrders}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">Pedidos procesados</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Por Despachar</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white">{pendingOrders}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">Órdenes pendientes de entrega</span>
          </div>
        </div>

        {/* Google Sheets Sync Widget */}
        <div className="mt-8">
          <GoogleSheetsSyncWidget tenantSlug={tenantSlug} tenantName={tenantName} />
        </div>
      </div>
    );
  } catch (error: any) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>No se pudieron cargar las analíticas: {error.message}</p>
      </div>
    );
  }
}

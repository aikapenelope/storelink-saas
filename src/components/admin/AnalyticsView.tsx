import React from 'react';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { headers } from 'next/headers';
import { GoogleSheetsSyncWidget } from './GoogleSheetsSyncWidget';
import {
  DollarSign,
  ShoppingCart,
  Users as UsersIcon,
  RotateCcw,
  Calendar,
  Upload,
  Store,
  ExternalLink,
  MoreHorizontal,
  ChevronDown,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  Package,
  Layers,
  BarChart3,
  CreditCard,
  Building2,
  Clock,
} from 'lucide-react';

export async function AnalyticsView() {
  try {
    const payload = await getPayload({ config });
    const headersList = await headers();
    const { user } = await payload.auth({ headers: headersList });

    if (!user) {
      return (
        <div className="p-8 text-center text-slate-400">
          <p>Debes iniciar sesión para ver las analíticas.</p>
        </div>
      );
    }

    const isSuperAdmin = user.role === 'super-admin';
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

    const tenantFilter: any = activeTenant?.id ? { tenant: { equals: activeTenant.id } } : undefined;

    const [ordersRes, productsRes, categoriesRes] = await Promise.all([
      payload.find({
        collection: 'orders',
        ...(tenantFilter ? { where: tenantFilter } : {}),
        limit: 500,
      }),
      payload.find({
        collection: 'products',
        ...(tenantFilter ? { where: tenantFilter } : {}),
        limit: 20,
      }),
      payload.find({
        collection: 'categories',
        ...(tenantFilter ? { where: tenantFilter } : {}),
        limit: 20,
      }),
    ]);

    const orders = ordersRes.docs || [];
    const products = productsRes.docs || [];
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
    const userName = (user as any).name || (user.email ? user.email.split('@')[0] : 'Comerciante');

    // Default top products from DB
    const displayProducts = products.slice(0, 4);

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 font-sans">
        <div className="max-w-[1400px] mx-auto space-y-6">
          {/* 1. Header (Rexora Style) */}
          <header className="flex items-center justify-between pb-4 border-b border-slate-800">
            <a href="/admin" className="flex items-center gap-2.5">
              <div className="flex flex-col gap-1">
                <div className="w-5 h-0.5 bg-emerald-400"></div>
                <div className="w-5 h-0.5 bg-emerald-400"></div>
                <div className="w-3 h-0.5 bg-emerald-400"></div>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">Rexora <span className="text-emerald-400">Analytics</span></span>
            </a>

            <nav className="hidden md:flex items-center bg-slate-900 rounded-full px-2 py-1 border border-slate-800">
              <a href="/admin/analytics" className="rounded-full px-4 py-1.5 text-xs font-bold transition-colors bg-emerald-500 text-slate-950">
                Dashboard
              </a>
              <a href="/admin/collections/orders" className="rounded-full px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors">
                Ventas
              </a>
              <a href="/admin/collections/products" className="rounded-full px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors">
                Productos
              </a>
              <a href="/admin/collections/categories" className="rounded-full px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors">
                Categorías
              </a>
              <a href="/admin" className="rounded-full px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors">
                Colecciones
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <a
                href={`https://flow.martes.app/${tenantSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold transition flex items-center gap-1.5"
              >
                <Store className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ver Tienda:</span> {tenantSlug}
                <ExternalLink className="w-3 h-3" />
              </a>

              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-md">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-white leading-tight">{userName}</p>
                  <p className="text-[10px] text-slate-400">{isSuperAdmin ? 'Super Admin' : 'Admin Tienda'}</p>
                </div>
              </div>
            </div>
          </header>

          {/* 2. Welcome Title & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Bienvenido, {userName} 👋</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Resumen ejecutivo de clientes, rendimiento de ventas y métricas para <strong className="text-white">{tenantName}</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              <button className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-300 transition flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>Esta Semana</span>
              </button>
              <a
                href={`https://flow.martes.app/${tenantSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Abrir Tienda PWA</span>
              </a>
            </div>
          </div>

          {/* 3. 4 Key Metric Cards (Rexora Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md hover:border-slate-700 transition">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ingresos Totales</span>
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-white mb-2">${totalRevenueUSD.toFixed(2)}</p>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+2.4% WoW</span>
                <span className="text-[11px] text-slate-500 font-normal">vs semana anterior</span>
              </div>
            </div>

            {/* Total Orders */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md hover:border-slate-700 transition">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total de Pedidos</span>
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                  <ShoppingCart className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-white mb-2">{totalOrders}</p>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+3.1% WoW</span>
                <span className="text-[11px] text-slate-500 font-normal">pedidos concretados</span>
              </div>
            </div>

            {/* Active Customers */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md hover:border-slate-700 transition">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Clientes Frecuentes</span>
                <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
                  <UsersIcon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-white mb-2">{Math.max(totalOrders, 1)}</p>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+1.8% WoW</span>
                <span className="text-[11px] text-slate-500 font-normal">clientes activos</span>
              </div>
            </div>

            {/* Pending / Delivery Rate */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md hover:border-slate-700 transition">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Por Despachar</span>
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-white mb-2">{pendingOrders}</p>
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
                <span>{pendingOrders > 0 ? 'En preparación' : 'Al día'}</span>
                <span className="text-[11px] text-slate-500 font-normal">órdenes en curso</span>
              </div>
            </div>
          </div>

          {/* 4. Middle Row: Profit Overview Chart + Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Profit Chart (col-span-2) */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                  <div>
                    <h2 className="text-base font-bold text-white">Rendimiento y Volumen de Ventas</h2>
                    <div className="flex items-center gap-2.5 mt-1.5">
                      <span className="text-2xl sm:text-3xl font-extrabold text-white">${totalRevenueUSD.toFixed(2)}</span>
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                        +8.4% <ArrowUpRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] text-slate-300 font-semibold border border-slate-700">
                      7 Días
                    </span>
                  </div>
                </div>

                {/* Channel Badges */}
                <div className="flex flex-wrap items-center gap-4 my-5 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span>Pago Móvil (VES)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                    <span>Zelle / Dólares ($)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <span>Efectivo / Delivery</span>
                  </div>
                </div>

                {/* Simulated Modern CSS Bar Chart */}
                <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-44 pt-4 border-b border-slate-800">
                  {[
                    { day: 'Lun', height: '65%', val: '$140' },
                    { day: 'Mar', height: '80%', val: '$220' },
                    { day: 'Mié', height: '45%', val: '$95' },
                    { day: 'Jue', height: '90%', val: '$310' },
                    { day: 'Vie', height: '70%', val: '$180' },
                    { day: 'Sáb', height: '100%', val: '$450' },
                    { day: 'Dom', height: '85%', val: '$280' },
                  ].map((bar, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-2 group h-full justify-end">
                      <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition">{bar.val}</span>
                      <div
                        className="w-full max-w-[36px] bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all duration-500 group-hover:from-emerald-500 group-hover:to-emerald-300"
                        style={{ height: bar.height }}
                      ></div>
                      <span className="text-xs font-bold text-slate-400">{bar.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Top Products (col-span-1) */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
                  <h2 className="text-base font-bold text-white">Productos Destacados</h2>
                  <a href="/admin/collections/products" className="text-xs text-emerald-400 hover:underline font-bold">
                    Ver todos
                  </a>
                </div>

                <div className="space-y-4">
                  {displayProducts.length > 0 ? (
                    displayProducts.map((p: any, idx: number) => (
                      <div key={p.id || idx} className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-800/50 transition">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-slate-400 shrink-0">
                            {p.images && p.images.length > 0 && p.images[0]?.image?.url ? (
                              <img src={p.images[0].image.url} alt={p.title} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5 text-emerald-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{p.title}</p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {typeof p.category === 'object' ? p.category?.title : 'Catálogo'}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-extrabold text-emerald-400 shrink-0">
                          ${Number(p.price || 0).toFixed(2)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      <p>Aún no hay productos cargados.</p>
                      <a href="/admin/collections/products/create" className="text-emerald-400 font-bold underline mt-1 block">
                        + Crear primer producto
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 5. Google Sheets Sync Widget Integrado */}
          <div className="pt-4">
            <GoogleSheetsSyncWidget tenantSlug={tenantSlug} tenantName={tenantName} />
          </div>
        </div>
      </div>
    );
  } catch (error: any) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Error cargando analíticas: {error.message}</p>
      </div>
    );
  }
}

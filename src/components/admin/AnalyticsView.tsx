import React from 'react';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { headers } from 'next/headers';
import { GoogleSheetsSyncWidget } from './GoogleSheetsSyncWidget';
import {
  DollarSign,
  ShoppingCart,
  Users as UsersIcon,
  Crown,
  RotateCcw,
  Calendar,
  Store,
  ExternalLink,
  Phone,
  Truck,
  AlertTriangle,
  Flame,
  PlusCircle,
  Package,
  Layers,
  BarChart3,
  TrendingUp,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Settings,
  Sparkles,
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
    let tenantId: number | string | null = null;
    let tenantDoc: any = null;

    if ((user as any)?.tenants && Array.isArray((user as any).tenants) && (user as any).tenants.length > 0) {
      const rawTenant = (user as any).tenants[0].tenant;
      tenantId = typeof rawTenant === 'object' && rawTenant !== null ? rawTenant.id : rawTenant;
    }

    if (tenantId) {
      tenantDoc = await payload.findByID({ collection: 'tenants', id: tenantId as any }).catch(() => null);
    }

    if (!tenantDoc) {
      const allTenants = await payload.find({ collection: 'tenants', limit: 1 });
      if (allTenants.docs.length > 0) {
        tenantDoc = allTenants.docs[0];
        tenantId = tenantDoc.id;
      }
    }

    const tenantSlug = tenantDoc?.slug || 'tienda';
    const tenantName = tenantDoc?.name || (isSuperAdmin ? 'Plataforma Global' : 'Mi Tienda');
    const rateVES = Number(tenantDoc?.branding?.exchangeRateVES) || 70.0;
    const storeUrl = `https://flow.martes.app/${tenantSlug}`;
    const userName = (user as any).name || (user.email ? user.email.split('@')[0] : 'Comerciante');

    const tenantFilter: any = tenantId ? { tenant: { equals: tenantId } } : undefined;

    // Fetch orders, customers, products and low stock items
    const [ordersRes, customersRes, productsRes, lowStockRes] = await Promise.all([
      payload.find({
        collection: 'orders',
        ...(tenantFilter ? { where: tenantFilter } : {}),
        limit: 300,
        sort: '-createdAt',
      }),
      payload.find({
        collection: 'customers',
        ...(tenantFilter ? { where: tenantFilter } : {}),
        limit: 50,
        sort: '-totalSpent',
      }),
      payload.find({
        collection: 'products',
        ...(tenantFilter ? { where: tenantFilter } : {}),
        limit: 20,
      }),
      payload.find({
        collection: 'products',
        where: {
          and: [
            ...(tenantFilter ? [{ tenant: { equals: tenantId } }] : []),
            { trackStock: { equals: true } },
            { stockQuantity: { less_than_equal: 5 } },
          ],
        },
        limit: 6,
      }),
    ]);

    const orders = (ordersRes.docs || []) as any[];
    const customers = (customersRes.docs || []) as any[];
    const products = (productsRes.docs || []) as any[];
    const lowStockProducts = (lowStockRes.docs || []) as any[];
    const totalOrders = orders.length;

    // 1. Compute Financial Metrics
    const totalSalesUSD = orders.reduce((acc, o) => acc + (Number(o.totalAmount || o.total) || 0), 0);
    const totalSalesVES = totalSalesUSD * rateVES;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todayOrders = orders.filter((o) => o.createdAt && o.createdAt.startsWith(todayStr));
    const todaySalesUSD = todayOrders.reduce((acc, o) => acc + (Number(o.totalAmount || o.total) || 0), 0);
    const todaySalesVES = todaySalesUSD * rateVES;

    const pendingOrdersCount = orders.filter(
      (o) => !o.status || o.status === 'pending' || o.status === 'preparing' || o.status === 'in_delivery'
    ).length;

    // 2. Compute 7-Day Trend
    const last7Days: Array<{ dateStr: string; label: string; amount: number; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
      const dayNum = d.getDate();

      const daysOrders = orders.filter((o) => o.createdAt && o.createdAt.startsWith(dateStr));
      const amount = daysOrders.reduce((acc, o) => acc + (Number(o.totalAmount || o.total) || 0), 0);

      last7Days.push({
        dateStr,
        label: `${dayName} ${dayNum}`,
        amount,
        count: daysOrders.length,
      });
    }
    const maxDaySales = Math.max(...last7Days.map((d) => d.amount), 1);

    // 3. Compute Best Sellers
    const productStats = new Map<string, { title: string; sku: string; units: number; revenue: number }>();
    orders.forEach((order) => {
      if (Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const key = item.sku || item.title || 'prod';
          const qty = Number(item.quantity) || 1;
          const subtotal = Number(item.subtotal || (Number(item.price) || 0) * qty);
          const existing = productStats.get(key) || {
            title: item.title || 'Producto',
            sku: item.sku || '',
            units: 0,
            revenue: 0,
          };
          existing.units += qty;
          existing.revenue += subtotal;
          productStats.set(key, existing);
        });
      }
    });

    const top5Products = Array.from(productStats.values())
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);

    // 4. Categorized CRM
    const categorizedCustomers = customers.map((c) => {
      const totalOrders = Number(c.totalOrders) || (c.savedAddresses?.length || 1);
      const totalSpent = Number(c.totalSpent) || 0;
      let tier: 'vip' | 'recurrente' | 'nuevo' = 'nuevo';
      if (totalOrders >= 3 || totalSpent >= 50 || c.tag === 'vip') {
        tier = 'vip';
      } else if (totalOrders === 2 || c.tag === 'frecuente') {
        tier = 'recurrente';
      }
      return { ...c, computedTier: tier, computedOrders: totalOrders, computedSpent: totalSpent };
    });

    const vipCount = categorizedCustomers.filter((c) => c.computedTier === 'vip').length;
    const recurrenteCount = categorizedCustomers.filter((c) => c.computedTier === 'recurrente').length;
    const nuevoCount = categorizedCustomers.filter((c) => c.computedTier === 'nuevo').length;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 font-sans">
        <div className="max-w-[1400px] mx-auto space-y-6">
          {/* ========================================================================= */}
          {/* 1. Header (Rexora Pill Navigation) */}
          {/* ========================================================================= */}
          <header className="flex items-center justify-between pb-4 border-b border-slate-800">
            <a href="/admin" className="flex items-center gap-2.5">
              <div className="flex flex-col gap-1">
                <div className="w-5 h-0.5 bg-emerald-400"></div>
                <div className="w-5 h-0.5 bg-emerald-400"></div>
                <div className="w-3 h-0.5 bg-emerald-400"></div>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Flow <span className="text-emerald-400">Commerce Pro</span>
              </span>
            </a>

            <nav className="hidden md:flex items-center bg-slate-900 rounded-full px-2 py-1 border border-slate-800">
              <a href="/admin/analytics" className="rounded-full px-4 py-1.5 text-xs font-bold transition-colors bg-emerald-500 text-slate-950">
                Dashboard
              </a>
              <a href="/admin/collections/orders" className="rounded-full px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors">
                Pedidos Shopify
              </a>
              <a href="/admin/collections/products" className="rounded-full px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors">
                Productos
              </a>
              <a href="/admin/collections/customers" className="rounded-full px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors">
                Clientes CRM
              </a>
              <a href="/admin" className="rounded-full px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors">
                Colecciones
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold transition flex items-center gap-1.5"
              >
                <Store className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tienda PWA:</span> {tenantSlug}
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

          {/* ========================================================================= */}
          {/* 2. Welcome Title & Quick Actions */}
          {/* ========================================================================= */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Bienvenido, {userName} 👋</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Panel de control y ventas estilo Shopify para <strong className="text-white">{tenantName}</strong> • Tasa Ref: <span className="font-mono text-emerald-400 font-bold">Bs. {rateVES.toFixed(2)} / $</span>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
              <a
                href="/admin/collections/products/create"
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs font-semibold text-white transition flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>+ Producto</span>
              </a>
              <a
                href="/admin/collections/orders"
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs font-semibold text-white transition flex items-center gap-1.5"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" />
                <span>Ver Pedidos</span>
              </a>
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Abrir Tienda PWA</span>
              </a>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. 4 Key Metric Cards (Rexora Grid Bimonetario) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Ventas Hoy */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md hover:border-slate-700 transition flex flex-col justify-between">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ventas de Hoy</span>
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-white mb-1">${todaySalesUSD.toFixed(2)}</p>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Bs. {todaySalesVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                <span className="text-emerald-400 font-bold font-sans text-[11px]">{todayOrders.length} hoy</span>
              </div>
            </div>

            {/* Ventas Totales */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md hover:border-slate-700 transition flex flex-col justify-between">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ventas Acumuladas</span>
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                  <ShoppingCart className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-white mb-1">${totalSalesUSD.toFixed(2)}</p>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Bs. {totalSalesVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                <span className="text-indigo-400 font-bold font-sans text-[11px]">{orders.length} órdenes</span>
              </div>
            </div>

            {/* Clientes CRM */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md hover:border-slate-700 transition flex flex-col justify-between">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Clientes en CRM</span>
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                  <UsersIcon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-white mb-1">{customers.length}</p>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-amber-400 font-semibold font-sans">
                <span className="flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  {vipCount} VIP / {recurrenteCount} Recurrentes
                </span>
              </div>
            </div>

            {/* Por Despachar */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md hover:border-slate-700 transition flex flex-col justify-between">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Por Despachar</span>
                <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-white mb-1">{pendingOrdersCount}</p>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-sans">
                <span>{products.length} productos activos</span>
                <span className="text-emerald-400 font-bold text-[11px]">{pendingOrdersCount > 0 ? 'En curso' : 'Al día'}</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 4. Alerta de Stock Bajo (Si aplica) */}
          {/* ========================================================================= */}
          {lowStockProducts.length > 0 && (
            <div className="bg-amber-950/40 border border-amber-800/60 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-200 shadow-md">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <span className="font-bold text-amber-300 block uppercase tracking-wider text-[11px]">
                  ⚠️ Alerta de Inventario: {lowStockProducts.length} productos con stock crítico (menos de 5 unidades)
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {lowStockProducts.map((p) => (
                    <a
                      key={p.id}
                      href={`/admin/collections/products/${p.id}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-900/60 border border-amber-700 text-amber-200 font-semibold hover:bg-amber-800 transition"
                    >
                      <span>{p.title}</span>
                      <span className="font-mono font-black text-[10px] bg-amber-800 px-1.5 py-0.5 rounded">
                        {p.stockQuantity !== undefined ? `${p.stockQuantity} uds` : 'Agotado'}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. Middle Row: Rendimiento Semanal + Top 5 Productos */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart (2/3) */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                  <div>
                    <h2 className="text-base font-bold text-white">Rendimiento de Ventas (Últimos 7 Días)</h2>
                    <div className="flex items-center gap-2.5 mt-1.5">
                      <span className="text-2xl sm:text-3xl font-extrabold text-white">${totalSalesUSD.toFixed(2)}</span>
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                        +8.4% <ArrowUpRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] text-slate-300 font-semibold border border-slate-700">
                    Últimos 7 Días
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 my-4 text-xs text-slate-400">
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

                <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-40 pt-4 border-b border-slate-800">
                  {last7Days.map((bar, idx) => {
                    const heightPercent = Math.max(Math.round((bar.amount / maxDaySales) * 100), 8);
                    const isToday = idx === 6;
                    return (
                      <div key={bar.dateStr} className="flex flex-col items-center gap-1.5 group h-full justify-end">
                        <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                          ${bar.amount.toFixed(0)}
                        </span>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full max-w-[36px] rounded-t-lg transition-all duration-500 ${
                            isToday
                              ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-md shadow-emerald-500/20'
                              : bar.amount > 0
                              ? 'bg-slate-700 hover:bg-slate-600'
                              : 'bg-slate-800/50'
                          }`}
                        ></div>
                        <span className={`text-xs font-bold ${isToday ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {bar.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Top 5 Products (1/3) */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <h2 className="text-base font-bold text-white">Top 5 Más Vendidos</h2>
                  </div>
                  <a href="/admin/collections/products" className="text-xs text-emerald-400 hover:underline font-bold">
                    Catálogo
                  </a>
                </div>

                <div className="space-y-3">
                  {top5Products.length > 0 ? (
                    top5Products.map((p, idx) => (
                      <div key={p.sku || p.title} className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-800/50 transition">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-700">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{p.title}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{p.sku || 'SKU'}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-extrabold text-emerald-400 font-mono block">{p.units} uds</span>
                          <span className="text-[10px] text-slate-400 font-mono">${p.revenue.toFixed(2)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      <p>Se calcularán automáticamente con tus ventas.</p>
                      <a href="/admin/collections/products/create" className="text-emerald-400 font-bold underline mt-1 block">
                        + Añadir productos
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 6. Pedidos Recientes Estilo Shopify */}
          {/* ========================================================================= */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Pedidos Recientes (Estilo Shopify)</h3>
              </div>
              <a href="/admin/collections/orders" className="text-xs font-semibold text-emerald-400 hover:underline">
                Ver todas las órdenes ➔
              </a>
            </div>

            {orders.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center font-medium">
                No hay pedidos registrados todavía.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">N° Pedido</th>
                      <th className="py-3 px-3">Cliente & Teléfono</th>
                      <th className="py-3 px-3">Modalidad</th>
                      <th className="py-3 px-3">Método de Pago</th>
                      <th className="py-3 px-3">Estado</th>
                      <th className="py-3 px-3 text-right">Total ($ USD / Bs.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {orders.slice(0, 6).map((order) => {
                      const totalUSD = Number(order.totalAmount || order.total) || 0;
                      const totalVES = totalUSD * rateVES;
                      const orderNum = order.orderNumber || order.id?.toString().slice(-6) || 'ORD';
                      const customerName = order.customerName || order.customer?.name || 'Cliente';
                      const phone = order.customerPhone || order.customer?.phone || '';
                      const payment = order.paymentMethod || 'Pago Móvil';
                      const status = order.status || 'pending';

                      return (
                        <tr key={order.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                            <a href={`/admin/collections/orders/${order.id}`} className="hover:underline">
                              #{orderNum}
                            </a>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-white block">{customerName}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{phone || '—'}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium text-[10px] border border-slate-700">
                              <Truck className="w-3 h-3 text-indigo-400" />
                              {order.deliveryType === 'delivery' ? 'Delivery' : 'Pick-up'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-300">{payment}</span>
                          </td>
                          <td className="py-3 px-3">
                            {status === 'pending' && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                                ⏳ Pendiente
                              </span>
                            )}
                            {status === 'preparing' && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">
                                🍳 En Preparación
                              </span>
                            )}
                            {status === 'delivered' && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                ✅ Entregado
                              </span>
                            )}
                            {status !== 'pending' && status !== 'preparing' && status !== 'delivered' && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold">
                                {status}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            <span className="font-extrabold text-white text-xs block">${totalUSD.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400">Bs. {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 7. Mini CRM con Contacto WhatsApp */}
          {/* ========================================================================= */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-4 h-4 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Mini CRM: Compradores & Contacto WhatsApp</h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">
                  👑 {vipCount} VIP
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
                  🔁 {recurrenteCount} Recurrentes
                </span>
              </div>
            </div>

            {categorizedCustomers.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center font-medium">
                Aparecerán automáticamente al recibir compras.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">Cliente</th>
                      <th className="py-3 px-3">Teléfono</th>
                      <th className="py-3 px-3">Segmento</th>
                      <th className="py-3 px-3">Gasto Acumulado (LTV)</th>
                      <th className="py-3 px-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {categorizedCustomers.slice(0, 6).map((c) => {
                      const phone = c.phone || '';
                      const cleanPhone = phone.replace(/\D/g, '');
                      const customerName = c.name || 'Cliente';
                      const prefilledMsg = encodeURIComponent(`¡Hola ${customerName}! Te escribimos de ${tenantName}. ¿Cómo podemos ayudarte?`);

                      return (
                        <tr key={c.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-3 font-bold text-white">{customerName}</td>
                          <td className="py-3 px-3 font-mono text-slate-300">{phone || '—'}</td>
                          <td className="py-3 px-3">
                            {c.computedTier === 'vip' ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                                👑 VIP ({c.computedOrders} compras)
                              </span>
                            ) : c.computedTier === 'recurrente' ? (
                              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">
                                🔁 Recurrente ({c.computedOrders} compras)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                                🌱 Nuevo
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-white">${c.computedSpent.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right">
                            {cleanPhone ? (
                              <a
                                href={`https://wa.me/${cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone}`}?text=${prefilledMsg}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-[11px] font-bold transition shadow-xs"
                              >
                                <Phone className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </a>
                            ) : (
                              <span className="text-slate-500 text-[10px]">Sin teléfono</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 8. Google Sheets Sync Widget */}
          {/* ========================================================================= */}
          <div className="pt-2">
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

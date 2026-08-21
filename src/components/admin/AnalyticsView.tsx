import React from 'react';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { headers } from 'next/headers';
import { GoogleSheetsSyncWidget } from './GoogleSheetsSyncWidget';
import {
  Wallet,
  ShoppingCart,
  Users,
  Package,
  TriangleAlert,
  ArrowUpRight,
  Store,
  ExternalLink,
  Plus,
  ClipboardList,
  ShoppingBag,
  Bell,
  ChevronDown,
  Search,
  Send,
  FileSpreadsheet,
  RefreshCw,
  Check,
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

    const tenantSlug = tenantDoc?.slug || 'aura-moda';
    const tenantName = tenantDoc?.name || (isSuperAdmin ? 'Plataforma Global' : 'Mi Tienda');
    const rateVES = Number(tenantDoc?.branding?.exchangeRateVES) || 70.0;
    const storeUrl = `https://flow.martes.app/${tenantSlug}`;
    const userName = (user as any).name || (user.email ? user.email.split('@')[0] : 'Comerciante');

    const tenantFilter: any = tenantId ? { tenant: { equals: tenantId } } : undefined;

    // Concurrently fetch orders, customers, products and low stock items
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

    // 1. Financial Metrics
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

    // Date formatting in Spanish
    const dateFormatted = now.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const dateTitle = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);

    // 2. 7-Day Trend
    const last7Days: Array<{ dateStr: string; label: string; amount: number; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });

      const daysOrders = orders.filter((o) => o.createdAt && o.createdAt.startsWith(dateStr));
      const amount = daysOrders.reduce((acc, o) => acc + (Number(o.totalAmount || o.total) || 0), 0);

      last7Days.push({
        dateStr,
        label: dayName.charAt(0).toUpperCase() + dayName.slice(1, 3),
        amount,
        count: daysOrders.length,
      });
    }
    const maxDaySales = Math.max(...last7Days.map((d) => d.amount), 1);

    // 3. Best Sellers
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

    const maxProductUnits = Math.max(...top5Products.map((p) => p.units), 1);

    // 4. Categorized CRM
    const categorizedCustomers = customers.map((c) => {
      const customerOrders = Number(c.totalOrders) || (c.savedAddresses?.length || 1);
      const totalSpent = Number(c.totalSpent) || 0;
      let tier: 'vip' | 'recurrente' | 'nuevo' = 'nuevo';
      if (customerOrders >= 3 || totalSpent >= 50 || c.tag === 'vip') {
        tier = 'vip';
      } else if (customerOrders === 2 || c.tag === 'frecuente') {
        tier = 'recurrente';
      }
      return { ...c, computedTier: tier, computedOrders: customerOrders, computedSpent: totalSpent };
    });

    const vipCount = categorizedCustomers.filter((c) => c.computedTier === 'vip').length;
    const recurrenteCount = categorizedCustomers.filter((c) => c.computedTier === 'recurrente').length;

    // User initials
    const userInitials = userName
      .split(' ')
      .map((n: string) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
        {/* ========================================================================= */}
        {/* 1. Header (Sticky SalesOps Navigation) */}
        {/* ========================================================================= */}
        <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-xl">
          <div className="mx-auto flex min-h-16 max-w-[1600px] flex-wrap items-center gap-4 px-4 py-3 sm:px-6 xl:px-8">
            <div className="flex shrink-0 items-center gap-3">
              <span className="flex flex-col gap-1">
                <span className="w-5 h-0.5 bg-emerald-400 rounded-full"></span>
                <span className="w-5 h-0.5 bg-emerald-400 rounded-full"></span>
                <span className="w-3 h-0.5 bg-emerald-400 rounded-full"></span>
              </span>
              <span className="hidden text-sm font-semibold tracking-tight sm:inline text-white">
                Flow Commerce <span className="text-emerald-400">Pro</span>
              </span>
            </div>

            <nav className="order-3 flex w-full overflow-x-auto border border-slate-800 bg-slate-900/90 rounded-xl p-1 lg:order-none lg:mx-auto lg:w-auto">
              <a
                href="/admin/analytics"
                className="shrink-0 px-4 py-1.5 text-xs font-semibold rounded-lg transition bg-emerald-500 text-slate-950 shadow-xs"
              >
                Dashboard
              </a>
              <a
                href="/admin/collections/orders"
                className="shrink-0 px-4 py-1.5 text-xs font-medium rounded-lg transition text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                Pedidos Shopify
              </a>
              <a
                href="/admin/collections/products"
                className="shrink-0 px-4 py-1.5 text-xs font-medium rounded-lg transition text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                Productos
              </a>
              <a
                href="/admin/collections/customers"
                className="shrink-0 px-4 py-1.5 text-xs font-medium rounded-lg transition text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                Clientes CRM
              </a>
              <a
                href="/admin"
                className="shrink-0 px-4 py-1.5 text-xs font-medium rounded-lg transition text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                Colecciones
              </a>
            </nav>

            <div className="ml-auto flex items-center gap-2.5">
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-2 border border-slate-800 bg-slate-900 hover:border-slate-700 px-3 py-1.5 text-xs rounded-xl text-slate-300 hover:text-white md:flex transition shadow-xs"
              >
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono text-emerald-400 font-semibold">{tenantSlug}</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>

              <div className="flex items-center gap-2 border border-slate-800 bg-slate-900 p-1 rounded-xl pr-3 shadow-xs">
                <span className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center">
                  {userInitials || 'AD'}
                </span>
                <span className="hidden text-left xl:block">
                  <span className="block text-xs font-semibold text-white leading-tight">{userName}</span>
                  <span className="block text-[10px] text-emerald-400 font-medium">
                    {isSuperAdmin ? 'Super Admin' : 'Admin Tienda'}
                  </span>
                </span>
              </div>

              <button className="border border-slate-800 bg-slate-900 p-2 rounded-xl text-slate-400 hover:text-white hover:border-slate-700 transition">
                <Bell className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* Main Content Dashboard */}
        {/* ========================================================================= */}
        <main className="mx-auto max-w-[1600px] space-y-8 px-4 py-8 sm:px-6 xl:px-8">
          {/* ========================================================================= */}
          {/* 2. Hero Panel */}
          {/* ========================================================================= */}
          <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 shadow-xl">
            <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Operación en línea · {dateTitle}
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Bienvenido/a, {userName}
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Panel de control y ventas para <span className="font-semibold text-white">{tenantName}</span>
                  <span className="mx-2 text-slate-700">•</span>
                  Tasa BCV <span className="font-mono text-emerald-400 font-bold">Bs. {rateVES.toFixed(2)} / $</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <a
                  href="/admin/collections/products/create"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition shadow-xs"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Producto</span>
                </a>
                <a
                  href="/admin/collections/orders"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition shadow-xs"
                >
                  <ClipboardList className="w-4 h-4 text-indigo-400" />
                  <span>Ver pedidos</span>
                </a>
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition shadow-lg shadow-emerald-500/20"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Abrir Tienda</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                </a>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 3. 4 Key Metric Cards (SalesOps style) */}
          {/* ========================================================================= */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Ventas de hoy */}
            <article className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-500/50 shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400 font-medium">Ventas de hoy</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-white">${todaySalesUSD.toFixed(2)}</p>
                </div>
                <span className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Wallet className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
                <span className="font-mono text-[11px] text-slate-400">
                  Bs. {todaySalesVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] font-semibold text-emerald-400">{todayOrders.length} hoy</span>
              </div>
            </article>

            {/* Card 2: Ventas acumuladas */}
            <article className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-500/50 shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400 font-medium">Ventas acumuladas</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-white">${totalSalesUSD.toFixed(2)}</p>
                </div>
                <span className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <ShoppingCart className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
                <span className="font-mono text-[11px] text-slate-400">
                  Bs. {totalSalesVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] font-semibold text-indigo-400">{orders.length} órdenes</span>
              </div>
            </article>

            {/* Card 3: Clientes en CRM */}
            <article className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-amber-500/50 shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400 font-medium">Clientes en CRM</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-white">{customers.length}</p>
                </div>
                <span className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
                <span className="font-mono text-[11px] text-slate-400">
                  {vipCount} VIP · {recurrenteCount} recurrentes
                </span>
                <span className="text-[11px] font-semibold text-amber-400">Activos</span>
              </div>
            </article>

            {/* Card 4: Por despachar */}
            <article className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-500/50 shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400 font-medium">Por despachar</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-white">{pendingOrdersCount}</p>
                </div>
                <span className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <Package className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
                <span className="font-mono text-[11px] text-slate-400">{products.length} productos activos</span>
                <span className="text-[11px] font-semibold text-emerald-400">
                  {pendingOrdersCount > 0 ? 'En curso' : 'Al día'}
                </span>
              </div>
            </article>
          </section>

          {/* ========================================================================= */}
          {/* 4. Alerta de Inventario Crítico */}
          {/* ========================================================================= */}
          {lowStockProducts.length > 0 && (
            <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-amber-800/60 bg-amber-950/30 p-4 sm:p-5 text-amber-200 shadow-md">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                  <TriangleAlert className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Alerta de inventario: {lowStockProducts.length} productos con stock crítico
                  </p>
                  <p className="mt-0.5 text-xs text-amber-200/70">
                    Reabastece pronto para evitar ventas perdidas.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {lowStockProducts.map((p) => (
                  <a
                    key={p.id}
                    href={`/admin/collections/products/${p.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-900/60 border border-amber-700 text-xs font-semibold text-amber-200 hover:bg-amber-800 transition"
                  >
                    <span>{p.title}</span>
                    <b className="font-mono text-[11px] bg-amber-950 px-1.5 py-0.5 rounded text-amber-300">
                      {p.stockQuantity !== undefined ? `${p.stockQuantity} uds` : 'Agotado'}
                    </b>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* ========================================================================= */}
          {/* 5. Gráfico 7 Días & Más Vendidos */}
          {/* ========================================================================= */}
          <section className="grid gap-6 xl:grid-cols-[1.4fr_.8fr]">
            {/* Chart (1.4fr) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                      Rendimiento · últimos 7 días
                    </p>
                    <h2 className="text-lg font-semibold text-white">Ventas y pedidos</h2>
                  </div>
                  <a
                    href="/admin/collections/orders"
                    className="text-xs text-slate-400 hover:text-emerald-400 transition inline-flex items-center gap-1"
                  >
                    Ver reporte →
                  </a>
                </div>

                <div className="flex h-56 items-end gap-2 border-b border-l border-slate-800/80 px-2 pb-0 pt-6 sm:gap-4">
                  {last7Days.map((bar, idx) => {
                    const heightPercent = Math.max(Math.round((bar.amount / maxDaySales) * 100), 8);
                    const isToday = idx === 6;
                    return (
                      <div key={bar.dateStr} className="flex h-full flex-1 flex-col items-center justify-end gap-2 group">
                        <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition font-mono whitespace-nowrap">
                          ${bar.amount.toFixed(0)}
                        </span>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full max-w-12 rounded-t-lg transition-all duration-300 ${
                            isToday
                              ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-md shadow-emerald-500/30'
                              : bar.amount > 0
                              ? 'bg-slate-700 hover:bg-slate-600'
                              : 'bg-slate-800/50'
                          }`}
                        ></div>
                        <span className={`font-mono text-[11px] ${isToday ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                          {bar.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-5 text-[11px] text-slate-400">
                  <span className="flex items-center gap-2">
                    <i className="w-2.5 h-2.5 rounded-full bg-emerald-400"></i> Ventas ${totalSalesUSD.toFixed(0)}
                  </span>
                  <span className="flex items-center gap-2">
                    <i className="w-2.5 h-2.5 rounded-full bg-indigo-400"></i> Pedidos {totalOrders}
                  </span>
                  <span className="ml-auto text-emerald-400 font-semibold inline-flex items-center gap-1">
                    +18.4% vs. semana anterior <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>

            {/* Más Vendidos (.8fr) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                      Catálogo
                    </p>
                    <h2 className="text-lg font-semibold text-white">Más vendidos</h2>
                  </div>
                  <a href="/admin/collections/products" className="text-xs text-slate-400 hover:text-emerald-400 transition">
                    Ver productos →
                  </a>
                </div>

                <div className="space-y-4">
                  {top5Products.length > 0 ? (
                    top5Products.map((p, idx) => {
                      const barPercent = Math.max(Math.round((p.units / maxProductUnits) * 100), 15);
                      return (
                        <div key={p.sku || p.title} className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-slate-500 w-6">
                            0{idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-white">{p.title}</p>
                            <div className="mt-1.5 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${barPercent}%` }}
                              ></div>
                            </div>
                          </div>
                          <span className="font-mono text-[11px] text-slate-400 font-semibold shrink-0">
                            {p.units} uds
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-xs text-slate-500">
                      <p>Se calcularán automáticamente con tus ventas.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 6. Pedidos Recientes (Shopify Style) */}
          {/* ========================================================================= */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
            <div className="flex flex-col gap-3 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                  Shopify
                </p>
                <h2 className="text-lg font-semibold text-white">Pedidos recientes</h2>
              </div>
              <div className="flex gap-2">
                <a
                  href="/admin/collections/orders"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition"
                >
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <span>Buscar</span>
                </a>
                <a
                  href="/admin/collections/orders"
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition shadow-xs"
                >
                  <span>Ver todos</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {orders.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">
                No hay pedidos registrados todavía en esta tienda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      <th className="px-5 py-3.5">Pedido</th>
                      <th className="px-5 py-3.5">Cliente</th>
                      <th className="px-5 py-3.5">Modalidad</th>
                      <th className="px-5 py-3.5">Total</th>
                      <th className="px-5 py-3.5">Estado</th>
                      <th className="px-5 py-3.5">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {orders.slice(0, 6).map((order) => {
                      const totalUSD = Number(order.totalAmount || order.total) || 0;
                      const orderNum = order.orderNumber || order.id?.toString().slice(-4) || '1048';
                      const customerName = order.customerName || order.customer?.name || 'Cliente';
                      const status = order.status || 'pending';
                      const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Reciente';

                      return (
                        <tr key={order.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-5 py-4 font-mono font-bold text-emerald-400">
                            <a href={`/admin/collections/orders/${order.id}`} className="hover:underline">
                              #{orderNum}
                            </a>
                          </td>
                          <td className="px-5 py-4 font-semibold text-white">{customerName}</td>
                          <td className="px-5 py-4 text-slate-400">
                            {order.deliveryType === 'delivery' ? 'Delivery Express' : 'Pick-up en Tienda'}
                          </td>
                          <td className="px-5 py-4 font-mono font-bold text-white">${totalUSD.toFixed(2)}</td>
                          <td className="px-5 py-4">
                            {status === 'pending' && (
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                                Procesando
                              </span>
                            )}
                            {status === 'preparing' && (
                              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">
                                Enviado
                              </span>
                            )}
                            {status === 'delivered' && (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                Pagado
                              </span>
                            )}
                            {status !== 'pending' && status !== 'preparing' && status !== 'delivered' && (
                              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold">
                                {status}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-slate-400 font-mono text-[11px]">{createdAt}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* 7. Bottom Grid: Mini CRM + Google Sheets */}
          {/* ========================================================================= */}
          <section className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
            {/* Mini CRM */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                      Mini CRM
                    </p>
                    <h2 className="text-lg font-semibold text-white">Clientes recientes</h2>
                  </div>
                  <a href="/admin/collections/customers" className="text-xs text-slate-400 hover:text-emerald-400 transition">
                    Abrir CRM →
                  </a>
                </div>

                <div className="space-y-1">
                  {categorizedCustomers.slice(0, 4).map((c) => {
                    const phone = c.phone || '';
                    const cleanPhone = phone.replace(/\D/g, '');
                    const customerName = c.name || 'Cliente';
                    const initials = customerName.split(' ').map((n: string) => n.charAt(0)).join('').toUpperCase().slice(0, 2);
                    const prefilledMsg = encodeURIComponent(`¡Hola ${customerName}! Te escribimos de ${tenantName}. ¿Cómo estás?`);

                    return (
                      <div key={c.id} className="flex items-center gap-3 border-b border-slate-800/60 py-3 last:border-0">
                        <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center shrink-0">
                          {initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white">{customerName}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {c.computedOrders} compras ·{' '}
                            <span className={c.computedTier === 'vip' ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                              {c.computedTier === 'vip' ? 'VIP' : c.computedTier === 'recurrente' ? 'Recurrente' : 'Nuevo'}
                            </span>
                          </p>
                        </div>
                        {cleanPhone ? (
                          <a
                            href={`https://wa.me/${cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone}`}?text=${prefilledMsg}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 border border-slate-700 rounded-xl transition shadow-xs"
                          >
                            <Send className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </a>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Google Sheets Widget */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                      Integración
                    </p>
                    <h2 className="text-lg font-semibold text-white">Google Sheets</h2>
                    <p className="mt-1 text-xs text-slate-400 max-w-sm">
                      Mantén tu catálogo de productos sincronizado con una hoja de cálculo central en 1 clic.
                    </p>
                  </div>
                  <FileSpreadsheet className="w-6 h-6 text-emerald-400 shrink-0" />
                </div>

                <div className="mt-4">
                  <GoogleSheetsSyncWidget tenantSlug={tenantSlug} tenantName={tenantName} />
                </div>
              </div>
            </div>
          </section>
        </main>
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

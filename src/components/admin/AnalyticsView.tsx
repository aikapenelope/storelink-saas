import React from 'react';
import Link from 'next/link';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { GoogleSheetsSyncWidget } from './GoogleSheetsSyncWidget';
import { ExchangeRateControl } from './ExchangeRateControl';
import { DashboardOrdersManager } from './DashboardOrdersManager';
import { getAllLiveExchangeRates, resolveExchangeRateVES } from '@/lib/exchange-rate';
import { getOrderKpis, getSalesSeries, getBestSellers } from '@/lib/analytics';
import { fetchOrdersPage } from '@/app/actions/admin-orders';
import { isSuperAdmin, getUserTenantIds } from '@/lib/utils';
import type { Tenant, User, Order, Customer, Product } from '@/payload-types';
import type { Where } from 'payload';
import {
  Wallet,
  ShoppingCart,
  Users,
  Package,
  TriangleAlert,
  Store,
  ExternalLink,
  Plus,
  ClipboardList,
  ShoppingBag,
  TrendingUp,
  FileSpreadsheet,
  Send,
} from 'lucide-react';

export async function AnalyticsView() {
  const headersList = await headers();
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: headersList });

  if (!user) {
    redirect('/admin/login?redirect=%2Fadmin%2Fanalytics');
  }

  try {
    const typedUser = user as User;
    const isSuperAdminUser = isSuperAdmin(user);
    const tenantIds = getUserTenantIds(user);
    const tenantId: number | string | null = tenantIds.length > 0 ? tenantIds[0] : null;
    let tenantDoc: Tenant | null = null;

    if (tenantId) {
      tenantDoc = (await payload.findByID({ collection: 'tenants', id: tenantId as number }).catch(() => null)) as Tenant | null;
    }

    if (!isSuperAdminUser && !tenantDoc) {
      return (
        <div className="p-12 text-center text-zinc-400 bg-black min-h-screen font-sans">
          <div className="max-w-md mx-auto p-6 border border-zinc-800 bg-zinc-950 shadow-2xl rounded-none">
            <h3 className="text-lg font-bold text-white mb-2">Tienda no asignada</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Tu cuenta de usuario todavía no tiene una tienda asignada. Contacta al administrador de la plataforma para vincular tu comercio.
            </p>
          </div>
        </div>
      );
    }

    let defaultTenantSlug = 'aurita';
    if (!tenantDoc && isSuperAdminUser) {
      const firstTenantRes = await payload.find({ collection: 'tenants', limit: 1 });
      if (firstTenantRes.docs.length > 0) {
        defaultTenantSlug = firstTenantRes.docs[0].slug;
      }
    }

    const tenantSlug = tenantDoc?.slug || defaultTenantSlug;
    const tenantName = tenantDoc?.name || (isSuperAdminUser ? 'Plataforma Global (Todas las Tiendas)' : 'Mi Tienda');
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://flow.martes.app';
    const storeUrl = `${siteUrl}/${tenantSlug}`;
    const userName = typedUser.email ? typedUser.email.split('@')[0] : 'Comerciante';

    // Fetch live market exchange rates (solo informativo para el widget)
    const liveRates = await getAllLiveExchangeRates();
    const customRate = tenantDoc?.branding?.exchangeRateVES
      ? Number(tenantDoc.branding.exchangeRateVES)
      : null;
    // Tasa activa (jerarquía del producto): manual > Binance en vivo >
    // dólar paralelo > ninguna (sin Bs)
    const { rate: rateVES, source: rateSource } = await resolveExchangeRateVES(tenantDoc);

    const tenantFilter: Where | undefined = tenantId ? { tenant: { equals: tenantId } } : undefined;

    // Pedidos: primera página (25) para la lista en vivo; el resto se pide
    // bajo demanda (paginación real). KPIs, serie y más vendidos vienen de
    // agregaciones SQL (src/lib/analytics.ts, zona America/Caracas) — ya no
    // se cargan 300 documentos para sumar en memoria.
    const [ordersRes, customersRes, productsRes, lowStockRes, kpis, series14, bestSellers] =
      await Promise.all([
        payload.find({
          collection: 'orders',
          ...(tenantFilter ? { where: tenantFilter } : {}),
          limit: 25,
          sort: '-createdAt',
          depth: 0,
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
          limit: 100,
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
        getOrderKpis(payload, tenantId),
        getSalesSeries(payload, tenantId, 14),
        getBestSellers(payload, tenantId, 5),
      ]);

    const orders = (ordersRes.docs || []) as Order[];
    const customers = (customersRes.docs || []) as Customer[];
    const products = (productsRes.docs || []) as Product[];
    const lowStockProducts = (lowStockRes.docs || []) as Product[];

    // 1. Financial Metrics (agregadas en SQL)
    const totalOrders = kpis.orderCount;
    const totalSalesUSD = kpis.totalUSD;
    const totalSalesVES = rateVES ? totalSalesUSD * rateVES : 0;
    const todaySalesUSD = kpis.todayUSD;
    const todaySalesVES = rateVES ? todaySalesUSD * rateVES : 0;
    const todayOrdersCount = kpis.todayOrderCount;
    const pendingOrdersCount = kpis.pendingCount;

    // Date formatting in Spanish
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const dateTitle = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);

    // 2. 7-Day Trend (últimos 7 de la serie de 14) + % real vs semana previa
    const last7Days = series14.slice(7);
    const currentWeekTotal = last7Days.reduce((acc, d) => acc + d.amount, 0);
    const prevWeekTotal = series14.slice(0, 7).reduce((acc, d) => acc + d.amount, 0);
    const changePct = prevWeekTotal > 0 ? ((currentWeekTotal - prevWeekTotal) / prevWeekTotal) * 100 : null;
    const maxDaySales = Math.max(...last7Days.map((d) => d.amount), 1);

    // 3. Best Sellers (agregado en SQL)
    const top5Products = bestSellers;
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
      <div className="min-h-screen font-sans antialiased text-zinc-100 bg-black selection:bg-white selection:text-black">
        {/* 1. Header Navigation with "Flow by martes.app" */}
        <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black/95 backdrop-blur-xl">
          <div className="mx-auto flex min-h-14 max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-2.5 sm:px-6 xl:px-8">
            <div className="flex shrink-0 items-center gap-3">
              <span className="flex flex-col gap-1 w-5">
                <span className="h-0.5 w-full bg-white"></span>
                <span className="h-0.5 w-3.5 bg-zinc-400 ml-1"></span>
                <span className="h-0.5 w-2 bg-zinc-600 ml-2"></span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-white uppercase font-mono">
                  Flow
                </span>
                <span className="text-[11px] font-mono text-zinc-400 border-l border-zinc-800 pl-2">
                  by <strong className="text-zinc-200 font-semibold">martes.app</strong>
                </span>
              </div>
            </div>

            <nav className="order-3 flex w-full overflow-x-auto border border-zinc-800 bg-zinc-950 p-0.5 lg:order-none lg:mx-auto lg:w-auto rounded-none">
              <Link
                href="/admin/analytics"
                className="shrink-0 px-3.5 py-1 text-xs font-bold transition bg-white text-black shadow-sm rounded-none uppercase tracking-wider"
              >
                Dashboard
              </Link>
              <Link
                href="/admin/collections/orders"
                className="shrink-0 px-3.5 py-1 text-xs font-medium transition text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-none uppercase tracking-wider"
              >
                Pedidos
              </Link>
              <Link
                href="/admin/collections/products"
                className="shrink-0 px-3.5 py-1 text-xs font-medium transition text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-none uppercase tracking-wider"
              >
                Productos
              </Link>
              <Link
                href="/admin/collections/customers"
                className="shrink-0 px-3.5 py-1 text-xs font-medium transition text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-none uppercase tracking-wider"
              >
                Clientes CRM
              </Link>
              <Link
                href="/admin"
                className="shrink-0 px-3.5 py-1 text-xs font-medium transition text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-none uppercase tracking-wider"
              >
                Colecciones
              </Link>
            </nav>

            <div className="flex items-center gap-2.5">
              {tenantSlug ? (
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden items-center gap-2 border border-zinc-800 bg-zinc-900 hover:border-zinc-600 px-3 py-1 text-xs text-zinc-300 hover:text-white md:flex transition rounded-none font-mono"
                >
                  <Store className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>/{tenantSlug}</span>
                  <ExternalLink className="w-3 h-3 text-zinc-500 shrink-0" />
                </a>
              ) : null}

              <div className="flex items-center gap-2 border border-zinc-800 bg-zinc-900 p-1 pr-3 rounded-none">
                <span className="w-6 h-6 bg-white text-black font-extrabold text-xs flex items-center justify-center shrink-0 rounded-none">
                  {userInitials || 'AD'}
                </span>
                <span className="hidden text-left xl:block">
                  <span className="block text-xs font-bold text-white leading-tight">{userName}</span>
                  <span className="block text-[9px] text-zinc-400 font-mono">
                    {isSuperAdminUser ? 'SUPER ADMIN' : 'TIENDA ADMIN'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 xl:px-8">
          {/* 2. Hero Panel */}
          <section className="border border-zinc-800 bg-zinc-950 p-5 shadow-2xl rounded-none">
            <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-mono text-zinc-400 uppercase tracking-wider">
                  <span className="w-2 h-2 bg-white inline-block"></span>
                  <span>Operación en línea · {dateTitle}</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {tenantName}
                </h1>
                <p className="mt-1 text-xs text-zinc-400">
                  Panel de ventas, gestión de pedidos y control de inventario
                  <span className="mx-2 text-zinc-700">•</span>
                  Tasa Activa: <span className="font-mono text-white font-bold">
                    {rateVES ? `Bs. ${rateVES.toFixed(2)} / $` : '— (sin tasa)'}
                  </span>
                  {rateSource === 'manual' ? (
                    <span className="ml-1.5 text-[10px] text-zinc-400 font-mono bg-zinc-900 px-1.5 py-0.5 border border-zinc-800">
                      (Personalizada)
                    </span>
                  ) : rateSource === 'binance' ? (
                    <span className="ml-1.5 text-[10px] text-zinc-400 font-mono bg-zinc-900 px-1.5 py-0.5 border border-zinc-800">
                      (Binance P2P en vivo)
                    </span>
                  ) : rateSource === 'paralelo' ? (
                    <span className="ml-1.5 text-[10px] text-zinc-400 font-mono bg-zinc-900 px-1.5 py-0.5 border border-zinc-800">
                      (Dólar paralelo)
                    </span>
                  ) : null}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/admin/collections/products/create"
                  className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-bold transition inline-flex items-center gap-1.5 rounded-none uppercase tracking-wider font-mono"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>+ Agregar Producto</span>
                </Link>
                <Link
                  href="/admin/collections/orders"
                  className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-bold transition inline-flex items-center gap-1.5 rounded-none uppercase tracking-wider font-mono"
                >
                  <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                  <span>Ver en Payload</span>
                </Link>
                {tenantSlug ? (
                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-white hover:bg-zinc-200 text-black text-xs font-bold transition inline-flex items-center gap-1.5 shadow-lg rounded-none uppercase tracking-wider font-mono"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                    <span>Abrir Tienda</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                ) : null}
              </div>
            </div>
          </section>

          {/* 3. 4 Key Metric Cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1 */}
            <article className="border border-zinc-800 bg-zinc-950 p-4 shadow-xl rounded-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400 font-mono uppercase tracking-wider">Ventas de hoy</p>
                  <p className="mt-1.5 text-2xl font-bold tracking-tight text-white font-mono">${todaySalesUSD.toFixed(2)}</p>
                </div>
                <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0 rounded-none">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-zinc-800/80 pt-2.5">
                {rateVES ? (
                  <span className="font-mono text-xs text-zinc-400">
                    Bs. {todaySalesVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                ) : null}
                <span className="text-xs font-mono text-white bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded-none">
                  {todayOrdersCount} hoy
                </span>
              </div>
            </article>

            {/* Card 2 */}
            <article className="border border-zinc-800 bg-zinc-950 p-4 shadow-xl rounded-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400 font-mono uppercase tracking-wider">Ventas totales</p>
                  <p className="mt-1.5 text-2xl font-bold tracking-tight text-white font-mono">${totalSalesUSD.toFixed(2)}</p>
                </div>
                <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0 rounded-none">
                  <ShoppingCart className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-zinc-800/80 pt-2.5">
                {rateVES ? (
                  <span className="font-mono text-xs text-zinc-400">
                    Bs. {totalSalesVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                ) : null}
                <span className="text-xs font-mono text-zinc-300 bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded-none">
                  {totalOrders} pedidos
                </span>
              </div>
            </article>

            {/* Card 3 */}
            <article className="border border-zinc-800 bg-zinc-950 p-4 shadow-xl rounded-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400 font-mono uppercase tracking-wider">Clientes CRM</p>
                  <p className="mt-1.5 text-2xl font-bold tracking-tight text-white font-mono">{kpis.customerCount}</p>
                </div>
                <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0 rounded-none">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-zinc-800/80 pt-2.5">
                <span className="font-mono text-xs text-zinc-400">
                  {vipCount} VIP · {recurrenteCount} recurrentes
                </span>
                <span className="text-xs font-mono text-white bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded-none">
                  Activos
                </span>
              </div>
            </article>

            {/* Card 4 */}
            <article className="border border-zinc-800 bg-zinc-950 p-4 shadow-xl rounded-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400 font-mono uppercase tracking-wider">Por despachar</p>
                  <p className="mt-1.5 text-2xl font-bold tracking-tight text-white font-mono">{pendingOrdersCount}</p>
                </div>
                <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0 rounded-none">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-zinc-800/80 pt-2.5">
                <span className="font-mono text-xs text-zinc-400">{products.length} productos en BD</span>
                <span className="text-xs font-mono text-white bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded-none">
                  {pendingOrdersCount > 0 ? 'En curso' : 'Al día'}
                </span>
              </div>
            </article>
          </section>

          {/* 4. Exchange Rate Control Panel */}
          <section>
            <ExchangeRateControl
              tenantSlug={tenantSlug}
              tenantName={tenantName}
              initialCustomRate={customRate}
              liveRates={liveRates}
            />
          </section>

          {/* 5. Alerta de Inventario Crítico */}
          {lowStockProducts.length > 0 && (
            <section className="border border-zinc-800 bg-zinc-950 p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-none">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0 rounded-none">
                  <TriangleAlert className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Alerta de inventario: {lowStockProducts.length} productos con stock crítico
                  </p>
                  <p className="text-xs text-zinc-400">
                    Reabastece pronto para evitar ventas perdidas.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {lowStockProducts.map((p) => (
                  <a
                    key={p.id}
                    href={`/admin/collections/products/${p.id}`}
                    className="px-2.5 py-1 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-xs text-zinc-200 flex items-center gap-1.5 transition rounded-none font-mono"
                  >
                    <span>{p.title}</span>
                    <b className="text-white">{p.stockQuantity !== undefined ? `${p.stockQuantity} uds` : 'Agotado'}</b>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* 6. Pedidos en Vivo con Confirmación y Filtros */}
          <section>
            <DashboardOrdersManager
              initialOrders={orders}
              tenantSlug={tenantSlug}
              tenantName={tenantName}
              rateVES={rateVES ?? 0}
              totalOrders={totalOrders}
              fetchPage={fetchOrdersPage}
            />
          </section>

          {/* 7. Gráfico 7 Días & Más Vendidos */}
          <section className="grid gap-4 xl:grid-cols-[1.4fr_.8fr]">
            {/* Chart */}
            <div className="border border-zinc-800 bg-zinc-950 p-4 shadow-xl rounded-none">
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                    Rendimiento · últimos 7 días
                  </p>
                  <h2 className="text-base font-bold text-white">Ventas y pedidos</h2>
                </div>
                <Link
                  href="/admin/collections/orders"
                  className="text-xs text-zinc-400 transition hover:text-white font-mono"
                >
                  Ver reporte →
                </Link>
              </div>

              <div className="flex h-48 items-end gap-2 border-b border-l border-zinc-800 px-2 pb-0 pt-4 sm:gap-4">
                {last7Days.map((bar, idx) => {
                  const heightPercent = Math.max(Math.round((bar.amount / maxDaySales) * 100), 8);
                  const isToday = idx === 6;
                  return (
                    <div key={bar.dateStr} className="flex h-full flex-1 flex-col items-center justify-end gap-2 group">
                      <div
                        className="w-full max-w-10 transition-all duration-300 rounded-none"
                        style={{
                          height: `${heightPercent}%`,
                          backgroundColor: isToday ? '#ffffff' : bar.amount > 0 ? '#52525b' : '#18181b',
                        }}
                      ></div>
                      <span className={`font-mono text-[10px] ${isToday ? 'text-white font-bold' : 'text-zinc-500'}`}>
                        {bar.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-400 font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-white"></span>
                  <strong className="text-white font-semibold">Ventas ${totalSalesUSD.toFixed(0)}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-zinc-500"></span>
                  <strong className="text-zinc-300">Pedidos {totalOrders}</strong>
                </span>
                <span className="ml-auto flex items-center gap-1 text-white font-bold">
                  {changePct !== null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%` : '—'}
                  <TrendingUp className="w-3.5 h-3.5 inline text-white" />
                </span>
              </div>
            </div>

            {/* Más Vendidos */}
            <div className="border border-zinc-800 bg-zinc-950 p-4 shadow-xl rounded-none">
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                    Catálogo
                  </p>
                  <h2 className="text-base font-bold text-white">Más vendidos</h2>
                </div>
                <Link href="/admin/collections/products" className="text-xs text-zinc-400 transition hover:text-white font-mono">
                  Ver catálogo →
                </Link>
              </div>

              <div className="space-y-3">
                {top5Products.length > 0 ? (
                  top5Products.map((p, idx) => {
                    const barPercent = Math.max(Math.round((p.units / maxProductUnits) * 100), 15);
                    return (
                      <div key={p.sku || p.title} className="flex items-center gap-3">
                        <span className="w-5 font-mono text-zinc-500 text-xs font-bold">0{idx + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-white">{p.title}</p>
                          <div className="mt-1 h-1 bg-zinc-800 rounded-none overflow-hidden">
                            <div className="h-full bg-white rounded-none" style={{ width: `${barPercent}%` }}></div>
                          </div>
                        </div>
                        <span className="font-mono text-xs text-zinc-300 font-semibold shrink-0">
                          {p.units} uds
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-xs text-zinc-500 font-mono">
                    <p>Se calcularán automáticamente con tus ventas.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 8. Bottom Grid: Mini CRM + Google Sheets */}
          <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
            {/* Mini CRM */}
            <div className="border border-zinc-800 bg-zinc-950 p-4 shadow-xl rounded-none">
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                    Mini CRM
                  </p>
                  <h2 className="text-base font-bold text-white">Clientes frecuentes</h2>
                </div>
                <Link href="/admin/collections/customers" className="text-xs text-zinc-400 transition hover:text-white font-mono">
                  Abrir CRM →
                </Link>
              </div>

              <div className="space-y-1">
                {categorizedCustomers.slice(0, 4).map((c) => {
                  const phone = c.phone || '';
                  const cleanPhone = phone.replace(/\D/g, '');
                  const customerName = c.name || 'Cliente';
                  const initials = customerName.split(' ').map((n: string) => n.charAt(0)).join('').toUpperCase().slice(0, 2);
                  const prefilledMsg = encodeURIComponent(`¡Hola ${customerName}! Te escribimos de ${tenantName}. ¿Cómo estás?`);

                  return (
                    <div key={c.id} className="flex items-center gap-3 border-b border-zinc-800/60 py-2.5 last:border-0">
                      <span className="w-7 h-7 bg-white text-black font-extrabold text-xs flex items-center justify-center shrink-0 rounded-none font-mono">
                        {initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">{customerName}</p>
                        <p className="text-[10px] text-zinc-400 font-mono">
                          {c.computedOrders} pedidos ·{' '}
                          <span className="text-white font-bold">
                            {c.computedTier === 'vip' ? 'VIP' : c.computedTier === 'recurrente' ? 'Recurrente' : 'Nuevo'}
                          </span>
                        </p>
                      </div>
                      {cleanPhone ? (
                        <a
                          href={`https://wa.me/${cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone}`}?text=${prefilledMsg}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-mono transition inline-flex items-center gap-1 shrink-0 rounded-none"
                        >
                          <Send className="w-3 h-3 shrink-0" />
                          <span>WhatsApp</span>
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Google Sheets Widget */}
            <div className="border border-zinc-800 bg-zinc-950 p-4 shadow-xl rounded-none">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                    Sincronización de Catálogo
                  </p>
                  <h2 className="text-base font-bold text-white">Google Sheets en Vivo</h2>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Actualiza tu catálogo pegando tu enlace de Google Sheets.
                  </p>
                </div>
                <FileSpreadsheet className="w-5 h-5 text-white shrink-0" />
              </div>

              <div className="mt-3">
                <GoogleSheetsSyncWidget tenantSlug={tenantSlug} tenantName={tenantName} />
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return (
      <div className="p-8 text-center text-zinc-400 bg-black min-h-screen font-sans">
        <p>Error cargando analíticas: {msg}</p>
      </div>
    );
  }
}

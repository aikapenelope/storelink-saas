'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
import { GoogleSheetsSyncWidget } from './GoogleSheetsSyncWidget';
import { ExchangeRateControl } from './ExchangeRateControl';
import { DashboardOrdersManager } from './DashboardOrdersManager';
import { CustomersRegistryManager } from './CustomersRegistryManager';
import { fetchOrdersPage } from '@/app/actions/admin-orders';
import type { Order, Customer, Product } from '@/payload-types';
import type { CustomerKpis, SalesDay, BestSeller } from '@/lib/analytics';

export interface CategorizedCustomer extends Customer {
  computedTier: 'vip' | 'recurrente' | 'nuevo';
  computedOrders: number;
  computedSpent: number;
}

export interface AnalyticsDashboardClientProps {
  initialTab?: 'performance' | 'customers';
  // User & Tenant info
  userName: string;
  userInitials: string;
  isSuperAdminUser: boolean;
  tenantSlug: string;
  tenantName: string;
  storeUrl: string;
  tenantId: number | string;
  dateTitle: string;
  rateVES: number;
  rateSource: 'manual' | 'binance' | 'paralelo' | 'none' | null;
  customRate: number | null;
  liveRates: {
    bcv: number | null;
    binance: number | null;
    paralelo: number | null;
  };
  // Financial & Inventory KPIs
  todaySalesUSD: number;
  todaySalesVES: number;
  todayOrdersCount: number;
  totalSalesUSD: number;
  totalSalesVES: number;
  totalOrders: number;
  pendingOrdersCount: number;
  totalProducts: number;
  lowStockProducts: Product[];
  // Orders & Chart
  initialOrders: Order[];
  last7Days: SalesDay[];
  changePct: number | null;
  maxDaySales: number;
  top5Products: BestSeller[];
  maxProductUnits: number;
  // Mini CRM (Top 4)
  categorizedCustomers: CategorizedCustomer[];
  // Full Customer CRM Data (for CustomersRegistryManager & KPIs)
  initialCustomers: Customer[];
  customerKpis: CustomerKpis;
  // Server Component slot for JobsStatusView
  jobsStatusView: React.ReactNode;
}

export function AnalyticsDashboardClient({
  initialTab = 'performance',
  userName,
  userInitials,
  isSuperAdminUser,
  tenantSlug,
  tenantName,
  storeUrl,
  tenantId,
  dateTitle,
  rateVES,
  rateSource,
  customRate,
  liveRates,
  todaySalesUSD,
  todaySalesVES,
  todayOrdersCount,
  totalSalesUSD,
  totalSalesVES,
  totalOrders,
  pendingOrdersCount,
  totalProducts,
  lowStockProducts,
  initialOrders,
  last7Days,
  changePct,
  maxDaySales,
  top5Products,
  maxProductUnits,
  categorizedCustomers,
  initialCustomers,
  customerKpis,
  jobsStatusView,
}: AnalyticsDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'performance' | 'customers'>(initialTab);
  const [kpis, setKpis] = useState<CustomerKpis>(customerKpis);

  // Sincronizar si el prop del servidor cambia
  useEffect(() => {
    setKpis(customerKpis);
  }, [customerKpis]);

  // Sincronizar estado de pestaña en montaje y navegación de historial (back / forward)
  useEffect(() => {
    const syncTabFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'customers') {
        setActiveTab('customers');
      } else {
        setActiveTab('performance');
      }
    };
    syncTabFromUrl();
    window.addEventListener('popstate', syncTabFromUrl);
    return () => window.removeEventListener('popstate', syncTabFromUrl);
  }, []);

  // Transición reactiva de pestaña sin recarga de página completa
  const handleTabChange = useCallback((tab: 'performance' | 'customers') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const currentTab = url.searchParams.get('tab') === 'customers' ? 'customers' : 'performance';
      if (currentTab !== tab) {
        if (tab === 'customers') {
          url.searchParams.set('tab', 'customers');
        } else {
          url.searchParams.delete('tab');
        }
        window.history.pushState({ tab }, '', url.pathname + url.search);
      }
    }
  }, []);

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
            <button
              type="button"
              onClick={() => handleTabChange('performance')}
              className={`shrink-0 px-3.5 py-1 text-xs font-bold transition rounded-none uppercase tracking-wider cursor-pointer ${
                activeTab === 'performance'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              Dashboard
            </button>
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
            <button
              type="button"
              onClick={() => handleTabChange('customers')}
              className={`shrink-0 px-3.5 py-1 text-xs font-bold transition rounded-none uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'customers'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <span>Clientes CRM</span>
              <span
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded-none font-bold ${
                  activeTab === 'customers'
                    ? 'bg-black text-white'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                {kpis.totalCustomers}
              </span>
            </button>
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
                <ExternalLink className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              </a>
            ) : null}

            <div className="flex items-center gap-2 border border-zinc-800 bg-zinc-900 p-1 pr-3 rounded-none">
              <span className="w-6 h-6 bg-white text-black font-extrabold text-xs flex items-center justify-center shrink-0 rounded-none font-mono">
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
                Panel de ventas, gestión de pedidos y control de clientes
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
                href={activeTab === 'customers' ? '/admin/collections/customers' : '/admin/collections/orders'}
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

        {/* 3. View Switcher Tabs */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-zinc-800 bg-zinc-950 p-2.5 rounded-none shadow-xl">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => handleTabChange('performance')}
              className={`px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider transition rounded-none inline-flex items-center gap-2 cursor-pointer ${
                activeTab === 'performance'
                  ? 'bg-white text-black shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Rendimiento y Ventas</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('customers')}
              className={`px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider transition rounded-none inline-flex items-center gap-2 cursor-pointer ${
                activeTab === 'customers'
                  ? 'bg-white text-black shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Registro de Compradores</span>
              <span
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded-none font-bold ${
                  activeTab === 'customers'
                    ? 'bg-black text-white'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                {kpis.totalCustomers}
              </span>
            </button>
          </div>
          <div className="text-[11px] font-mono text-zinc-500 hidden md:flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-pulse"></span>
            <span>
              {activeTab === 'performance'
                ? 'Métricas de pedidos, ingresos e inventario en vivo'
                : 'Directorio de compradores, segmentación RFM y WhatsApp'}
            </span>
          </div>
        </section>

        {/* 4. Tab Content: Performance & Orders */}
        <div className={activeTab === 'performance' ? 'space-y-5' : 'hidden'}>
          {/* Key Metric Cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Ventas de hoy */}
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

            {/* Card 2: Ventas totales */}
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

            {/* Card 3: Clientes CRM (Interactivo: abre el directorio de compradores) */}
            <article
              onClick={() => handleTabChange('customers')}
              className="border border-zinc-800 bg-zinc-950 p-4 shadow-xl rounded-none cursor-pointer hover:border-zinc-600 transition group"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleTabChange('customers');
                }
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-zinc-400 font-mono uppercase tracking-wider group-hover:text-zinc-200 transition">
                      Clientes CRM
                    </p>
                    <span className="text-[10px] text-zinc-500 group-hover:text-white transition font-mono">→</span>
                  </div>
                  <p className="mt-1.5 text-2xl font-bold tracking-tight text-white font-mono">{kpis.totalCustomers}</p>
                </div>
                <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0 rounded-none group-hover:border-zinc-500 group-hover:bg-zinc-800 transition">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-zinc-800/80 pt-2.5">
                <span className="font-mono text-xs text-zinc-400">
                  {kpis.vipCount} VIP · {kpis.recurrentCount} frecuentes
                </span>
                <span className="text-xs font-mono text-white bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded-none group-hover:border-zinc-500 transition">
                  Directorio →
                </span>
              </div>
            </article>

            {/* Card 4: Por despachar */}
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
                <span className="font-mono text-xs text-zinc-400">{totalProducts} productos en BD</span>
                <span className="text-xs font-mono text-white bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded-none">
                  {pendingOrdersCount > 0 ? 'En curso' : 'Al día'}
                </span>
              </div>
            </article>
          </section>

          {/* Jobs Status Panel */}
          {jobsStatusView}

          {/* Exchange Rate Control Panel */}
          <section>
            <ExchangeRateControl
              tenantSlug={tenantSlug}
              tenantName={tenantName}
              initialCustomRate={customRate}
              liveRates={liveRates}
            />
          </section>

          {/* Alerta de Inventario Crítico */}
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

          {/* Pedidos en Vivo con Confirmación y Filtros */}
          <section>
            <DashboardOrdersManager
              initialOrders={initialOrders}
              tenantSlug={tenantSlug}
              tenantName={tenantName}
              rateVES={rateVES}
              totalOrders={totalOrders}
              fetchPage={fetchOrdersPage}
            />
          </section>

          {/* Gráfico 7 Días & Más Vendidos */}
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

          {/* Bottom Grid: Mini CRM + Google Sheets */}
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
                <button
                  type="button"
                  onClick={() => handleTabChange('customers')}
                  className="text-xs text-zinc-400 transition hover:text-white font-mono inline-flex items-center gap-1 cursor-pointer"
                >
                  Abrir CRM →
                </button>
              </div>

              <div className="space-y-1">
                {categorizedCustomers.length === 0 ? (
                  <div className="text-center py-6 text-xs text-zinc-500 font-mono">
                    <p>Aún no hay clientes registrados.</p>
                  </div>
                ) : (
                  categorizedCustomers.slice(0, 4).map((c) => {
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
                            href={`https://wa.me/${encodeURIComponent(cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone}`)}?text=${prefilledMsg}`}
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
                  })
                )}
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
        </div>

        {/* 5. Tab Content: Customer Directory CRM */}
        <div className={activeTab === 'customers' ? 'space-y-5' : 'hidden'}>
          <CustomersRegistryManager
            initialCustomers={initialCustomers}
            initialKpis={kpis}
            tenantSlug={tenantSlug}
            tenantName={tenantName}
            tenantId={tenantId}
            onKpisChange={setKpis}
          />
        </div>
      </main>
    </div>
  );
}

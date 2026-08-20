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
  Phone,
  Truck,
  Store,
  AlertTriangle,
  Flame,
  PlusCircle,
  Image as ImageIcon,
  Settings,
  Sparkles,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export async function MerchantDashboard() {
  try {
    const payload = await getPayload({ config });
    const headersList = await headers();
    const { user } = await payload.auth({ headers: headersList });

    if (!user) {
      return null;
    }

    const isSuperAdmin = user.role === 'super-admin';

    // -------------------------------------------------------------
    // SUPER ADMIN VIEW: Platform-wide Overview
    // -------------------------------------------------------------
    if (isSuperAdmin) {
      const [tenantsRes, productsRes, ordersRes, customersRes] = await Promise.all([
        payload.find({ collection: 'tenants', limit: 100 }),
        payload.find({ collection: 'products', limit: 1 }),
        payload.find({ collection: 'orders', limit: 1000 }),
        payload.find({ collection: 'customers', limit: 1 }),
      ]);

      const totalTenants = tenantsRes.totalDocs || tenantsRes.docs.length;
      const totalProducts = productsRes.totalDocs || 0;
      const totalOrders = ordersRes.totalDocs || ordersRes.docs.length;
      const totalCustomers = customersRes.totalDocs || 0;

      const totalRevenueUSD = ordersRes.docs.reduce(
        (acc, o: any) => acc + (Number(o.totalAmount || o.total) || 0),
        0
      );

      return (
        <div className="w-full mb-8 space-y-6 animate-in fade-in duration-300 font-sans">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3">
                  <Crown className="w-3.5 h-3.5" />
                  Panel Maestro Super Admin • Flow
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Plataforma SaaS Flow
                </h2>
                <p className="text-sm text-slate-300 font-medium mt-1">
                  Gestiona todos los comercios, catálogos e infraestructura en <span className="text-emerald-400 font-semibold">martes.app</span>.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href="/admin/collections/tenants/create"
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Crear Nuevo Comercio</span>
                </a>
              </div>
            </div>
          </div>

          {/* Super Admin Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Comercios Activos
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900 dark:text-white">{totalTenants}</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                  Tenants
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Productos Globales
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900 dark:text-white">{totalProducts}</span>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full">
                  Catálogos
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Pedidos Totales
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900 dark:text-white">{totalOrders}</span>
                <span className="text-xs text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded-full">
                  Órdenes
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Facturación Acumulada
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ${totalRevenueUSD.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400 font-medium">USD</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------
    // MERCHANT (TENANT-ADMIN) VIEW: Complete 5-Feature Dashboard
    // -------------------------------------------------------------
    let tenantId: number | string | null = null;

    if ((user as any)?.tenants && Array.isArray((user as any).tenants) && (user as any).tenants.length > 0) {
      const rawTenant = (user as any).tenants[0].tenant;
      tenantId = typeof rawTenant === 'object' && rawTenant !== null ? rawTenant.id : rawTenant;
    }

    let tenantDoc: any = null;
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

    if (!tenantDoc) {
      return null;
    }

    const tenantSlug = tenantDoc.slug || 'tienda';
    const tenantName = tenantDoc.name || 'Mi Comercio';
    const rateVES = Number(tenantDoc.branding?.exchangeRateVES) || 70.0;
    const storeUrl = `https://${tenantSlug}.martes.app`;

    // Concurrently fetch orders, customers, products and low stock items
    const [ordersRes, customersRes, productsRes, lowStockRes] = await Promise.all([
      payload.find({
        collection: 'orders',
        where: { tenant: { equals: tenantId } },
        limit: 200,
        sort: '-createdAt',
      }),
      payload.find({
        collection: 'customers',
        where: { tenant: { equals: tenantId } },
        limit: 50,
        sort: '-totalSpent',
      }),
      payload.find({
        collection: 'products',
        where: { tenant: { equals: tenantId } },
        limit: 1,
      }),
      payload.find({
        collection: 'products',
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { trackStock: { equals: true } },
            { stockQuantity: { less_than_equal: 5 } },
          ],
        },
        limit: 10,
      }),
    ]);

    const orders = ordersRes.docs as any[];
    const customers = customersRes.docs as any[];
    const totalProducts = productsRes.totalDocs || 0;
    const lowStockProducts = lowStockRes.docs as any[];

    // -------------------------------------------------------------
    // 1. Compute Key Financial Metrics
    // -------------------------------------------------------------
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

    // -------------------------------------------------------------
    // 2. Compute 7-Day Sales Trend (Last 7 Days)
    // -------------------------------------------------------------
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

    // -------------------------------------------------------------
    // 3. Compute Top 5 Best Sellers from historical orders
    // -------------------------------------------------------------
    const productStats = new Map<string, { title: string; sku: string; units: number; revenue: number }>();

    orders.forEach((order) => {
      if (Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const key = item.sku || item.title;
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

    // -------------------------------------------------------------
    // 4. Compute Categorized CRM Customers (VIP / Recurrente / Nuevo)
    // -------------------------------------------------------------
    const categorizedCustomers = customers.map((c) => {
      const totalOrders = Number(c.totalOrders) || (c.savedAddresses?.length || 1);
      const totalSpent = Number(c.totalSpent) || 0;

      let tier: 'vip' | 'recurrente' | 'nuevo' = 'nuevo';
      if (totalOrders >= 3 || totalSpent >= 50 || c.tag === 'vip') {
        tier = 'vip';
      } else if (totalOrders === 2 || c.tag === 'frecuente') {
        tier = 'recurrente';
      }

      return {
        ...c,
        computedTier: tier,
        computedOrders: totalOrders,
        computedSpent: totalSpent,
      };
    });

    const vipCount = categorizedCustomers.filter((c) => c.computedTier === 'vip').length;
    const recurrenteCount = categorizedCustomers.filter((c) => c.computedTier === 'recurrente').length;
    const nuevoCount = categorizedCustomers.filter((c) => c.computedTier === 'nuevo').length;

    return (
      <div className="w-full mb-8 space-y-6 animate-in fade-in duration-300 font-sans">
        {/* ========================================================================= */}
        {/* 1. Header de Tienda & URL en Vivo */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Tienda Activa en Línea
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                <span>{tenantName}</span>
                {tenantDoc.theme && (
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-slate-800/80 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700">
                    Tema: {tenantDoc.theme}
                  </span>
                )}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 flex items-center gap-2">
                <span>Tu Subdominio Oficial:</span>
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-emerald-400 hover:text-emerald-300 underline font-bold flex items-center gap-1"
                >
                  <span>{tenantSlug}.martes.app</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
              >
                <span>Ver Mi Tienda PWA</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href="/admin/collections/products/create"
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition border border-slate-700 flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>+ Producto</span>
              </a>

              <a
                href="/admin/collections/media/create"
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition border border-slate-700 flex items-center gap-1.5"
              >
                <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                <span>Subir Fotos</span>
              </a>

              <a
                href={`/admin/collections/tenants/${tenantId}`}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition border border-slate-700 flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5 text-amber-400" />
                <span>Cuentas de Pago</span>
              </a>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. Tarjetas de Métricas Clave (KPIs) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Ventas Hoy */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Ventas de Hoy
                </span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                ${todaySalesUSD.toFixed(2)}
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span>Bs. {todaySalesVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
              <span className="text-[10px] text-emerald-600 font-semibold">{todayOrders.length} hoy</span>
            </div>
          </div>

          {/* Card 2: Ventas Totales */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Ventas Acumuladas
                </span>
                <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                ${totalSalesUSD.toFixed(2)}
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span>Bs. {totalSalesVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
              <span className="text-[10px] text-purple-600 font-semibold">{orders.length} órdenes</span>
            </div>
          </div>

          {/* Card 3: Clientes & Segmentación CRM */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Clientes en CRM
                </span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <UsersIcon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {customers.length}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                <Crown className="w-3 h-3" />
                {vipCount} VIP / {recurrenteCount} Recurrentes
              </span>
            </div>
          </div>

          {/* Card 4: Pedidos por Despachar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Por Despachar
                </span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {pendingOrdersCount}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span>{totalProducts} productos activos</span>
              <span className="text-[10px] text-emerald-600 font-bold">Catálogo OK</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. Alerta de Stock Bajo (Si aplica) */}
        {/* ========================================================================= */}
        {lowStockProducts.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-950 dark:text-amber-200 shadow-xs animate-in fade-in duration-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <span className="font-bold text-amber-900 dark:text-amber-300 block uppercase tracking-wider text-[11px]">
                ⚠️ Alerta de Inventario: {lowStockProducts.length} productos con stock crítico (menos de 5 unidades)
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                {lowStockProducts.map((p) => (
                  <a
                    key={p.id}
                    href={`/admin/collections/products/${p.id}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/80 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-semibold hover:bg-amber-200 transition"
                  >
                    <span>{p.title}</span>
                    <span className="font-mono font-black text-[10px] bg-amber-200 dark:bg-amber-800 px-1.5 py-0.5 rounded">
                      {p.stockQuantity !== undefined ? `${p.stockQuantity} uds` : 'Agotado'}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. Gráfico de Ventas de los Últimos 7 Días & Top 5 Productos */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 7-Day Performance Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Rendimiento de Ventas (Últimos 7 Días)
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                Tasa ref: {rateVES.toFixed(2)} Bs/$
              </span>
            </div>

            <div className="grid grid-cols-7 gap-2 items-end h-40 pt-4 px-2">
              {last7Days.map((d, i) => {
                const heightPercent = Math.max(Math.round((d.amount / maxDaySales) * 100), 8);
                const isToday = i === 6;

                return (
                  <div key={d.dateStr} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                      ${d.amount.toFixed(0)}
                    </span>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-xl transition-all duration-300 relative ${
                        isToday
                          ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-md shadow-emerald-500/30'
                          : d.amount > 0
                          ? 'bg-slate-800 hover:bg-slate-700'
                          : 'bg-slate-100 dark:bg-slate-800/40'
                      }`}
                    >
                      {d.count > 0 && (
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-black text-slate-400">
                          {d.count}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-medium tracking-tight truncate ${
                        isToday ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top 5 Best Sellers */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Flame className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Top 5 Más Vendidos
              </h3>
            </div>

            {top5Products.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center font-medium">
                Se calcularán automáticamente con tus primeras ventas.
              </p>
            ) : (
              <div className="space-y-2.5">
                {top5Products.map((p, idx) => (
                  <div
                    key={p.sku || p.title}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-[10px] flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <span className="font-bold text-slate-900 dark:text-white block truncate">
                          {p.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {p.sku || 'SKU'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 pl-2">
                      <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-xs block">
                        {p.units} uds
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ${p.revenue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. Google Sheets Quick Sync Bar */}
        {/* ========================================================================= */}
        <GoogleSheetsSyncWidget tenantSlug={tenantSlug} tenantName={tenantName} />

        {/* ========================================================================= */}
        {/* 6. Mini CRM Completo con Segmentación (VIP / Recurrente / Nuevo) */}
        {/* ========================================================================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Mini CRM: Compradores, Segmentación & Fidelización
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px]">
                👑 {vipCount} VIP
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px]">
                🔁 {recurrenteCount} Recurrentes
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px]">
                🌱 {nuevoCount} Nuevos
              </span>
            </div>
          </div>

          {categorizedCustomers.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center font-medium">
              Aún no hay clientes registrados. Aparecerán automáticamente al recibir pedidos en la tienda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Teléfono WhatsApp</th>
                    <th className="py-2.5 px-3">Segmento</th>
                    <th className="py-2.5 px-3">Gasto Acumulado (LTV)</th>
                    <th className="py-2.5 px-3">Ubicación Habitual</th>
                    <th className="py-2.5 px-3 text-right">Contacto WhatsApp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {categorizedCustomers.slice(0, 10).map((c) => {
                    const phone = c.phone || '';
                    const cleanPhone = phone.replace(/\D/g, '');
                    const customerName = c.name || 'Cliente';
                    const prefilledMsg = encodeURIComponent(
                      `¡Hola ${customerName}! Te escribimos de ${tenantName}. ¿Cómo estás?`
                    );

                    return (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                          {customerName}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                          {phone || '—'}
                        </td>
                        <td className="py-3 px-3">
                          {c.computedTier === 'vip' && (
                            <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-black text-[10px] px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                              <Crown className="w-3 h-3" />
                              👑 VIP ({c.computedOrders} compras)
                            </span>
                          )}
                          {c.computedTier === 'recurrente' && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 dark:text-blue-300 font-bold bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full">
                              🔁 Recurrente ({c.computedOrders} compras)
                            </span>
                          )}
                          {c.computedTier === 'nuevo' && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                              🌱 Nuevo (1 compra)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          ${c.computedSpent > 0 ? c.computedSpent.toFixed(2) : '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400 font-medium truncate max-w-[180px]">
                          {c.savedAddresses && c.savedAddresses.length > 0
                            ? `${c.savedAddresses[0].municipality || ''} ${c.savedAddresses[0].address || ''}`.trim() || 'Caracas'
                            : '—'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {cleanPhone ? (
                            <a
                              href={`https://wa.me/${cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone}`}?text=${prefilledMsg}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-xl text-[11px] font-bold transition border border-emerald-200 dark:border-emerald-800 shadow-xs"
                            >
                              <Phone className="w-3 h-3 text-emerald-600" />
                              <span>Escribir WhatsApp</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Sin teléfono</span>
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
        {/* 7. Pedidos Recientes con Estilo Moderno */}
        {/* ========================================================================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Pedidos Recientes
              </h3>
            </div>
            <a
              href="/admin/collections/orders"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
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
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">N° Pedido</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Modalidad</th>
                    <th className="py-2.5 px-3">Método Pago</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3">Total (USD / VES)</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {orders.slice(0, 8).map((o) => {
                    const totalUSD = Number(o.totalAmount || o.total) || 0;
                    const totalVES = totalUSD * rateVES;
                    const isDelivery = o.deliveryType === 'delivery';
                    const orderNum = o.orderNumber || `#${o.id}`;

                    return (
                      <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {orderNum}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">
                            {o.customer?.name || o.customerName || 'Cliente'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {o.customer?.phone || o.customerPhone || ''}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            {isDelivery ? (
                              <>
                                <Truck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Delivery</span>
                              </>
                            ) : (
                              <>
                                <Store className="w-3.5 h-3.5 text-amber-600" />
                                <span>Pickup</span>
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 capitalize">
                            {o.paymentDetails?.methodKey || o.customer?.paymentMethod || o.paymentMethodKey || 'WhatsApp'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {o.status === 'delivered' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              Entregado
                            </span>
                          ) : o.status === 'in_delivery' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded-full">
                              <Truck className="w-3 h-3" />
                              En Camino
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3" />
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            ${totalUSD.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            Bs. {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <a
                            href={`/admin/collections/orders/${o.id}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            <span>Gestionar</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  } catch (err) {
    console.error('Error rendering MerchantDashboard:', err);
    return null;
  }
}

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
  Check,
} from 'lucide-react';

export async function AnalyticsView() {
  try {
    const payload = await getPayload({ config });
    const headersList = await headers();
    const { user } = await payload.auth({ headers: headersList });

    if (!user) {
      return (
        <div className="p-8 text-center text-zinc-400 bg-zinc-950 min-h-screen">
          <p>Debes iniciar sesión para ver las analíticas.</p>
        </div>
      );
    }

    const isSuperAdmin = (user as any).role === 'super-admin';
    let tenantId: number | string | null = null;
    let tenantDoc: any = null;

    if ((user as any)?.tenants && Array.isArray((user as any).tenants) && (user as any).tenants.length > 0) {
      const rawTenant = (user as any).tenants[0].tenant;
      tenantId = typeof rawTenant === 'object' && rawTenant !== null ? rawTenant.id : rawTenant;
      if (typeof rawTenant === 'object' && rawTenant !== null) {
        tenantDoc = rawTenant;
      }
    }

    if (tenantId && !tenantDoc) {
      tenantDoc = await payload.findByID({ collection: 'tenants', id: tenantId as any }).catch(() => null);
    }

    // If Super Admin and no specific tenant, allow viewing the first store as platform overview
    if (!tenantDoc && isSuperAdmin) {
      const allTenants = await payload.find({ collection: 'tenants', limit: 1 });
      if (allTenants.docs.length > 0) {
        tenantDoc = allTenants.docs[0];
        tenantId = tenantDoc.id;
      }
    }

    // 🔒 Audit Fix #2.4: Prevent cross-tenant data leak if regular merchant has no tenant configured
    if (!isSuperAdmin && !tenantDoc) {
      return (
        <div className="p-12 text-center text-zinc-400 bg-zinc-950 min-h-screen font-sans">
          <div className="max-w-md mx-auto p-6 rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Tienda no asignada</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Tu cuenta de usuario todavía no tiene una tienda asignada. Contacta al administrador de la plataforma para vincular tu comercio.
            </p>
          </div>
        </div>
      );
    }

    const tenantSlug = tenantDoc?.slug || '';
    const tenantName = tenantDoc?.name || (isSuperAdmin ? 'Plataforma Global' : 'Mi Tienda');
    const rateVES = Number(tenantDoc?.branding?.exchangeRateVES) || 70.0;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://flow.martes.app';
    const storeUrl = tenantSlug ? `${siteUrl}/${tenantSlug}` : siteUrl;
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
      <div className="salesops-dark-root min-h-screen font-sans antialiased text-zinc-100 bg-black selection:bg-white selection:text-black">
        <style dangerouslySetInnerHTML={{ __html: `
          .salesops-dark-root {
            --background: #000000;
            --foreground: #ffffff;
            --card: #09090b;
            --card-subtle: #121215;
            --border: #27272a;
            --border-subtle: #1e1e24;
            --primary: #ffffff;
            --primary-foreground: #000000;
            --secondary: #18181b;
            --muted-foreground: #a1a1aa;
            background-color: #000000;
            background-image: 
              radial-gradient(circle at 80% 0%, rgba(255, 255, 255, 0.04), transparent 25%),
              linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
            background-size: auto, 48px 48px, 48px 48px;
          }
          .salesops-dark-root .dashboard-panel {
            border: 1px solid #27272a;
            background: #09090b;
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);
          }
          .salesops-dark-root .hero-panel {
            border: 1px solid #3f3f46;
            position: relative;
            overflow: hidden;
            background: linear-gradient(110deg, #09090b, #000000);
            padding: 1.5rem;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);
          }
          .salesops-dark-root .hero-panel:after {
            content: "";
            border: 1px solid rgba(255, 255, 255, 0.08);
            width: 20rem;
            height: 20rem;
            position: absolute;
            top: -7rem;
            right: -5rem;
            background: rgba(255, 255, 255, 0.02);
            pointer-events: none;
            transform: rotate(18deg);
          }
          .salesops-dark-root .brand-mark {
            flex-direction: column;
            gap: 0.25rem;
            width: 1.75rem;
            display: flex;
          }
          .salesops-dark-root .brand-mark span {
            background: #ffffff;
            height: 0.25rem;
            border-radius: 9999px;
          }
          .salesops-dark-root .brand-mark span:nth-child(2) {
            background: #a1a1aa;
            width: 1.25rem;
            margin-left: 0.25rem;
          }
          .salesops-dark-root .brand-mark span:nth-child(3) {
            background: #52525b;
            width: 0.75rem;
            margin-left: 0.5rem;
          }
          .salesops-dark-root .avatar {
            background: #ffffff;
            width: 2rem;
            height: 2rem;
            color: #000000;
            justify-content: center;
            align-items: center;
            font-size: 11px;
            font-weight: 800;
            display: inline-flex;
            border-radius: 0.5rem;
          }
          .salesops-dark-root .metric-icon {
            border: 1px solid #3f3f46;
            justify-content: center;
            align-items: center;
            width: 2.5rem;
            height: 2.5rem;
            display: inline-flex;
            background: #18181b;
            color: #ffffff;
            border-radius: 0.75rem;
          }
          .salesops-dark-root .action-button {
            border: 1px solid #27272a;
            align-items: center;
            gap: 0.5rem;
            padding: 0.625rem 0.875rem;
            font-size: 0.75rem;
            font-weight: 600;
            transition: all 0.2s;
            display: inline-flex;
            background: #18181b;
            color: #f4f4f5;
            cursor: pointer;
            border-radius: 0.75rem;
          }
          .salesops-dark-root .action-button:hover {
            border-color: #52525b;
            background: #27272a;
            color: #ffffff;
          }
          .salesops-dark-root .primary-button {
            border: 1px solid #ffffff;
            align-items: center;
            gap: 0.5rem;
            padding: 0.625rem 0.875rem;
            font-size: 0.75rem;
            font-weight: 700;
            transition: all 0.2s;
            display: inline-flex;
            background: #ffffff;
            color: #000000;
            cursor: pointer;
            border-radius: 0.75rem;
          }
          .salesops-dark-root .primary-button:hover {
            background: #e4e4e7;
          }
          .salesops-dark-root .status-dot {
            background: #ffffff;
            width: 0.5rem;
            height: 0.5rem;
            border-radius: 9999px;
            box-shadow: 0 0 0 0.25rem rgba(255, 255, 255, 0.15);
            display: inline-block;
          }
          .salesops-dark-root .inventory-alert {
            border: 1px solid #3f3f46;
            background: #121215;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            border-radius: 1rem;
          }
          @media (min-width: 1024px) {
            .salesops-dark-root .inventory-alert {
              flex-direction: row;
              justify-content: space-between;
              align-items: center;
            }
          }
          .salesops-dark-root .alert-icon {
            border: 1px solid #3f3f46;
            background: #18181b;
            color: #ffffff;
            width: 2.5rem;
            height: 2.5rem;
            display: inline-flex;
            justify-content: center;
            align-items: center;
            border-radius: 0.75rem;
          }
          .salesops-dark-root .stock-tag {
            border: 1px solid #27272a;
            background: #18181b;
            color: #f4f4f5;
            padding: 0.375rem 0.625rem;
            font-size: 11px;
            display: inline-flex;
            align-items: center;
            border-radius: 0.5rem;
          }
          .salesops-dark-root .stock-tag b {
            color: #ffffff;
            margin-left: 0.3rem;
          }
          .salesops-dark-root .status-tag {
            border: 1px solid #3f3f46;
            background: #18181b;
            color: #ffffff;
            padding: 0.25rem 0.625rem;
            font-size: 10px;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            border-radius: 9999px;
          }
          .salesops-dark-root .sync-box {
            border: 1px solid #27272a;
            background: #09090b;
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
            padding: 0.875rem;
            border-radius: 1rem;
          }
          .salesops-dark-root .sync-icon {
            background: #18181b;
            border: 1px solid #3f3f46;
            width: 2rem;
            height: 2rem;
            color: #ffffff;
            display: inline-flex;
            justify-content: center;
            align-items: center;
            border-radius: 0.5rem;
          }
          .salesops-dark-root .product-rank {
            width: 1.5rem;
            font-family: monospace;
            color: #71717a;
            font-size: 10px;
          }
          .salesops-dark-root .legend-dot {
            width: 0.5rem;
            height: 0.5rem;
            display: inline-block;
            border-radius: 9999px;
          }
        `}} />

        {/* ========================================================================= */}
        {/* 1. Header (High Contrast Black Navigation) */}
        {/* ========================================================================= */}
        <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black/95 backdrop-blur-xl">
          <div className="mx-auto flex min-h-16 max-w-[1600px] flex-wrap items-center gap-4 px-4 py-3 sm:px-6 xl:px-8">
            <div className="flex shrink-0 items-center gap-3">
              <span className="brand-mark">
                <span></span>
                <span></span>
                <span></span>
              </span>
              <span className="hidden text-sm font-bold tracking-tight sm:inline text-white">
                Flow Commerce <span className="text-zinc-400">Pro</span>
              </span>
            </div>

            <nav className="order-3 flex w-full overflow-x-auto border border-zinc-800 bg-zinc-950 p-1 rounded-xl lg:order-none lg:mx-auto lg:w-auto">
              <a
                href="/admin/analytics"
                className="shrink-0 px-4 py-1.5 text-xs font-bold rounded-lg transition bg-white text-black shadow-sm"
              >
                Dashboard
              </a>
              <a
                href="/admin/collections/orders"
                className="shrink-0 px-4 py-1.5 text-xs font-medium rounded-lg transition text-zinc-400 hover:text-white hover:bg-zinc-900"
              >
                Pedidos Shopify
              </a>
              <a
                href="/admin/collections/products"
                className="shrink-0 px-4 py-1.5 text-xs font-medium rounded-lg transition text-zinc-400 hover:text-white hover:bg-zinc-900"
              >
                Productos
              </a>
              <a
                href="/admin/collections/customers"
                className="shrink-0 px-4 py-1.5 text-xs font-medium rounded-lg transition text-zinc-400 hover:text-white hover:bg-zinc-900"
              >
                Clientes CRM
              </a>
              <a
                href="/admin"
                className="shrink-0 px-4 py-1.5 text-xs font-medium rounded-lg transition text-zinc-400 hover:text-white hover:bg-zinc-900"
              >
                Colecciones
              </a>
            </nav>

            <div className="ml-auto flex items-center gap-2.5">
              {tenantSlug ? (
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden items-center gap-2 border border-zinc-800 bg-zinc-900 hover:border-zinc-700 px-3 py-1.5 text-xs rounded-xl text-zinc-300 hover:text-white md:flex transition shadow-sm"
                >
                  <Store className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-mono text-white font-medium">{tenantSlug}</span>
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </a>
              ) : null}

              <div className="flex items-center gap-2 border border-zinc-800 bg-zinc-900 p-1 rounded-xl pr-3 shadow-sm">
                <span className="avatar">{userInitials || 'AD'}</span>
                <span className="hidden text-left xl:block">
                  <span className="block text-xs font-bold text-white leading-tight">{userName}</span>
                  <span className="block text-[10px] text-zinc-400 font-medium">
                    {isSuperAdmin ? 'Super Admin' : 'Admin Tienda'}
                  </span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
              </div>

              <button className="border border-zinc-800 bg-zinc-900 p-2 rounded-xl text-zinc-400 hover:text-white hover:border-zinc-700 transition">
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
          <section className="hero-panel rounded-2xl">
            <div className="relative flex flex-col justify-between gap-7 xl:flex-row xl:items-end">
              <div>
                <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <span className="status-dot"></span> Operación en línea · {dateTitle}
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Bienvenido/a, {userName}
                </h1>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Panel de control y ventas para <span className="font-semibold text-white">{tenantName}</span>
                  <span className="mx-2 text-zinc-700">•</span>
                  Tasa BCV <span className="font-mono text-white font-bold">Bs. {rateVES.toFixed(2)} / $</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <a href="/admin/collections/products/create" className="action-button">
                  <Plus className="w-4 h-4" />
                  <span>Producto</span>
                </a>
                <a href="/admin/collections/orders" className="action-button">
                  <ClipboardList className="w-4 h-4" />
                  <span>Ver pedidos</span>
                </a>
                {tenantSlug ? (
                  <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="primary-button">
                    <ShoppingBag className="w-4 h-4" />
                    <span>Abrir Tienda</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 3. 4 Key Metric Cards (SalesOps Dark High Contrast) */}
          {/* ========================================================================= */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Ventas de hoy */}
            <article className="dashboard-panel rounded-2xl group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-600">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400 font-medium">Ventas de hoy</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-white">${todaySalesUSD.toFixed(2)}</p>
                </div>
                <span className="metric-icon">
                  <Wallet className="w-4 h-4 text-white" />
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-3">
                <span className="font-mono text-[11px] text-zinc-400">
                  Bs. {todaySalesVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] font-bold text-white">{todayOrders.length} hoy</span>
              </div>
            </article>

            {/* Card 2: Ventas acumuladas */}
            <article className="dashboard-panel rounded-2xl group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-600">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400 font-medium">Ventas acumuladas</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-white">${totalSalesUSD.toFixed(2)}</p>
                </div>
                <span className="metric-icon">
                  <ShoppingCart className="w-4 h-4 text-white" />
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-3">
                <span className="font-mono text-[11px] text-zinc-400">
                  Bs. {totalSalesVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] font-bold text-zinc-300">{orders.length} órdenes</span>
              </div>
            </article>

            {/* Card 3: Clientes en CRM */}
            <article className="dashboard-panel rounded-2xl group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-600">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400 font-medium">Clientes en CRM</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-white">{customers.length}</p>
                </div>
                <span className="metric-icon">
                  <Users className="w-4 h-4 text-white" />
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-3">
                <span className="font-mono text-[11px] text-zinc-400">
                  {vipCount} VIP · {recurrenteCount} recurrentes
                </span>
                <span className="text-[11px] font-bold text-zinc-300">Activos</span>
              </div>
            </article>

            {/* Card 4: Por despachar */}
            <article className="dashboard-panel rounded-2xl group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-600">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400 font-medium">Por despachar</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-white">{pendingOrdersCount}</p>
                </div>
                <span className="metric-icon">
                  <Package className="w-4 h-4 text-white" />
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-3">
                <span className="font-mono text-[11px] text-zinc-400">{products.length} productos activos</span>
                <span className="text-[11px] font-bold text-white">
                  {pendingOrdersCount > 0 ? 'En curso' : 'Al día'}
                </span>
              </div>
            </article>
          </section>

          {/* ========================================================================= */}
          {/* 4. Alerta de Inventario Crítico */}
          {/* ========================================================================= */}
          {lowStockProducts.length > 0 && (
            <section className="inventory-alert">
              <div className="flex items-center gap-3">
                <span className="alert-icon">
                  <TriangleAlert className="w-5 h-5 text-white" />
                </span>
                <div>
                  <p className="text-sm font-bold text-white">
                    Alerta de inventario: {lowStockProducts.length} productos con stock crítico
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Reabastece pronto para evitar ventas perdidas.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {lowStockProducts.map((p) => (
                  <a
                    key={p.id}
                    href={`/admin/collections/products/${p.id}`}
                    className="stock-tag hover:border-zinc-500 transition"
                  >
                    <span>{p.title}</span>
                    <b className="font-mono">{p.stockQuantity !== undefined ? `${p.stockQuantity} uds` : 'Agotado'}</b>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* ========================================================================= */}
          {/* 5. Gráfico 7 Días & Más Vendidos */}
          {/* ========================================================================= */}
          <section className="grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
            {/* Chart (1.4fr) */}
            <div className="dashboard-panel rounded-2xl p-5">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                    Rendimiento · últimos 7 días
                  </p>
                  <h2 className="text-lg font-bold text-white">Ventas y pedidos</h2>
                </div>
                <a
                  href="/admin/collections/orders"
                  className="text-xs text-zinc-400 transition hover:text-white"
                >
                  Ver reporte →
                </a>
              </div>

              <div className="flex h-56 items-end gap-2 border-b border-l border-zinc-800 px-2 pb-0 pt-5 sm:gap-4">
                {last7Days.map((bar, idx) => {
                  const heightPercent = Math.max(Math.round((bar.amount / maxDaySales) * 100), 8);
                  const isToday = idx === 6;
                  return (
                    <div key={bar.dateStr} className="flex h-full flex-1 flex-col items-center justify-end gap-2 group">
                      <div
                        className="w-full max-w-12 rounded-t transition-all duration-300"
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

              <div className="mt-4 flex flex-wrap items-center gap-5 text-[11px] text-zinc-400">
                <span className="flex items-center gap-2">
                  <i className="legend-dot bg-white"></i> Ventas ${totalSalesUSD.toFixed(0)}
                </span>
                <span className="flex items-center gap-2">
                  <i className="legend-dot bg-zinc-500"></i> Pedidos {totalOrders}
                </span>
                <span className="ml-auto flex items-center gap-1 text-white font-bold">
                  +18.4% vs. semana anterior <ArrowUpRight className="w-3.5 h-3.5 inline" />
                </span>
              </div>
            </div>

            {/* Más Vendidos (.8fr) */}
            <div className="dashboard-panel rounded-2xl p-5">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                    Catálogo
                  </p>
                  <h2 className="text-lg font-bold text-white">Más vendidos</h2>
                </div>
                <a href="/admin/collections/products" className="text-xs text-zinc-400 transition hover:text-white">
                  Ver productos →
                </a>
              </div>

              <div className="space-y-4">
                {top5Products.length > 0 ? (
                  top5Products.map((p, idx) => {
                    const barPercent = Math.max(Math.round((p.units / maxProductUnits) * 100), 15);
                    return (
                      <div key={p.sku || p.title} className="flex items-center gap-3">
                        <span className="product-rank">0{idx + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-white">{p.title}</p>
                          <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-white rounded-full" style={{ width: `${barPercent}%` }}></div>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] text-zinc-400 font-medium">
                          {p.units} uds
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-xs text-zinc-500">
                    <p>Se calcularán automáticamente con tus ventas.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 6. Pedidos Recientes (Shopify Style) */}
          {/* ========================================================================= */}
          <section className="dashboard-panel rounded-2xl overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-zinc-800 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                  Shopify
                </p>
                <h2 className="text-lg font-bold text-white">Pedidos recientes</h2>
              </div>
              <div className="flex gap-2">
                <a href="/admin/collections/orders" className="action-button">
                  <Search className="w-3.5 h-3.5" />
                  <span>Buscar</span>
                </a>
                <a href="/admin/collections/orders" className="primary-button">
                  <span>Ver todos</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {orders.length === 0 ? (
              <p className="p-8 text-center text-xs text-zinc-500">
                No hay pedidos registrados todavía en esta tienda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                      <th className="px-5 py-3.5">Pedido</th>
                      <th className="px-5 py-3.5">Cliente</th>
                      <th className="px-5 py-3.5">Modalidad</th>
                      <th className="px-5 py-3.5">Total</th>
                      <th className="px-5 py-3.5">Estado</th>
                      <th className="px-5 py-3.5">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 5).map((order) => {
                      const totalUSD = Number(order.totalAmount || order.total) || 0;
                      const orderNum = order.orderNumber || order.id?.toString().slice(-4) || '1048';
                      const customerName = order.customerName || order.customer?.name || 'Cliente';
                      const status = order.status || 'pending';
                      const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Reciente';

                      return (
                        <tr key={order.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/50 transition">
                          <td className="px-5 py-4 font-mono font-bold text-white">
                            <a href={`/admin/collections/orders/${order.id}`} className="hover:underline">
                              #{orderNum}
                            </a>
                          </td>
                          <td className="px-5 py-4 font-semibold text-white">{customerName}</td>
                          <td className="px-5 py-4 text-zinc-400">
                            {order.deliveryType === 'delivery' ? 'Delivery Express' : 'Pick-up en Tienda'}
                          </td>
                          <td className="px-5 py-4 font-mono font-bold text-white">${totalUSD.toFixed(2)}</td>
                          <td className="px-5 py-4">
                            {status === 'pending' && (
                              <span className="status-tag">Procesando</span>
                            )}
                            {status === 'preparing' && (
                              <span className="status-tag">Enviado</span>
                            )}
                            {status === 'delivered' && (
                              <span className="status-tag bg-white text-black font-bold">Pagado</span>
                            )}
                            {status !== 'pending' && status !== 'preparing' && status !== 'delivered' && (
                              <span className="status-tag">{status}</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-zinc-400 font-mono text-[11px]">{createdAt}</td>
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
          <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
            {/* Mini CRM */}
            <div className="dashboard-panel rounded-2xl p-5">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                    Mini CRM
                  </p>
                  <h2 className="text-lg font-bold text-white">Clientes recientes</h2>
                </div>
                <a href="/admin/collections/customers" className="text-xs text-zinc-400 transition hover:text-white">
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
                    <div key={c.id} className="flex items-center gap-3 border-b border-zinc-800/60 py-3 last:border-0">
                      <span className="avatar">
                        {initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white">{customerName}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-400">
                          {c.computedOrders} compras ·{' '}
                          <span className={c.computedTier === 'vip' ? 'text-white font-bold' : 'text-zinc-300'}>
                            {c.computedTier === 'vip' ? 'VIP' : c.computedTier === 'recurrente' ? 'Recurrente' : 'Nuevo'}
                          </span>
                        </p>
                      </div>
                      {cleanPhone ? (
                        <a
                          href={`https://wa.me/${cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone}`}?text=${prefilledMsg}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="action-button px-3 py-1.5 text-[11px]"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Google Sheets Widget */}
            <div className="dashboard-panel rounded-2xl p-5">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                    Integración
                  </p>
                  <h2 className="text-lg font-bold text-white">Google Sheets</h2>
                  <p className="mt-1 text-xs text-zinc-400 max-w-sm">
                    Mantén tu catálogo sincronizado con una hoja de cálculo central.
                  </p>
                </div>
                <FileSpreadsheet className="w-6 h-6 text-white" />
              </div>

              <div className="mt-4">
                {tenantSlug ? (
                  <GoogleSheetsSyncWidget tenantSlug={tenantSlug} tenantName={tenantName} />
                ) : (
                  <p className="text-xs text-zinc-500">Selecciona una tienda para sincronizar.</p>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  } catch (error: any) {
    return (
      <div className="p-8 text-center text-zinc-400 bg-black min-h-screen">
        <p>Error cargando analíticas: {error.message}</p>
      </div>
    );
  }
}

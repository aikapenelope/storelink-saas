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
      <div className="salesops-root min-h-screen text-slate-100 font-sans antialiased">
        <style dangerouslySetInnerHTML={{ __html: `
          .salesops-root {
            --background: #090d16;
            --foreground: #f8fafc;
            --card: #0f172a;
            --border: #1e293b;
            --primary: #10b981;
            --primary-foreground: #022c22;
            --secondary: #1e293b;
            --muted-foreground: #94a3b8;
            --chart-1: #3b82f6;
            --chart-2: #06b6d4;
            --warning: #f59e0b;
            --destructive: #ef4444;
            background-color: var(--background);
            background-image: radial-gradient(circle at 78% 0%, rgba(59, 130, 246, 0.08), transparent 24%),
              linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
            background-size: auto, 64px 64px, 64px 64px;
          }
          .salesops-root .dashboard-panel {
            border: 1px solid var(--border);
            background: rgba(15, 23, 42, 0.95);
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.25);
          }
          .salesops-root .hero-panel {
            border: 1px solid rgba(16, 185, 129, 0.25);
            position: relative;
            overflow: hidden;
            background: linear-gradient(110deg, rgba(15, 23, 42, 0.95), #090d16);
            padding: 1.5rem;
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
          }
          .salesops-root .hero-panel:after {
            content: "";
            border: 1px solid rgba(16, 185, 129, 0.15);
            width: 20rem;
            height: 20rem;
            position: absolute;
            top: -7rem;
            right: -5rem;
            background: rgba(16, 185, 129, 0.06);
            pointer-events: none;
            transform: rotate(18deg);
          }
          .salesops-root .brand-mark {
            flex-direction: column;
            gap: 0.25rem;
            width: 1.75rem;
            display: flex;
          }
          .salesops-root .brand-mark span {
            background: var(--primary);
            height: 0.25rem;
            border-radius: 9999px;
          }
          .salesops-root .brand-mark span:nth-child(2) {
            background: var(--chart-1);
            width: 1.25rem;
            margin-left: 0.25rem;
          }
          .salesops-root .brand-mark span:nth-child(3) {
            background: var(--chart-2);
            width: 0.75rem;
            margin-left: 0.5rem;
          }
          .salesops-root .avatar {
            background: var(--primary);
            width: 2rem;
            height: 2rem;
            color: var(--primary-foreground);
            justify-content: center;
            align-items: center;
            font-size: 10px;
            font-weight: 700;
            display: inline-flex;
          }
          .salesops-root .metric-icon {
            border: 1px solid rgba(16, 185, 129, 0.3);
            justify-content: center;
            align-items: center;
            width: 2.5rem;
            height: 2.5rem;
            display: inline-flex;
            background: rgba(16, 185, 129, 0.1);
            color: var(--primary);
          }
          .salesops-root .metric-blue {
            color: var(--chart-1);
            border-color: rgba(59, 130, 246, 0.3);
            background: rgba(59, 130, 246, 0.1);
          }
          .salesops-root .metric-amber {
            color: var(--warning);
            border-color: rgba(245, 158, 11, 0.3);
            background: rgba(245, 158, 11, 0.1);
          }
          .salesops-root .metric-cyan {
            color: var(--chart-2);
            border-color: rgba(6, 182, 212, 0.3);
            background: rgba(6, 182, 212, 0.1);
          }
          .salesops-root .action-button {
            border: 1px solid var(--border);
            align-items: center;
            gap: 0.5rem;
            padding: 0.625rem 0.875rem;
            font-size: 0.75rem;
            font-weight: 500;
            transition: all 0.2s;
            display: inline-flex;
            background: var(--card);
            color: var(--foreground);
            cursor: pointer;
          }
          .salesops-root .action-button:hover {
            border-color: var(--primary);
            background: var(--secondary);
            color: #fff;
          }
          .salesops-root .primary-button {
            border: 1px solid var(--primary);
            align-items: center;
            gap: 0.5rem;
            padding: 0.625rem 0.875rem;
            font-size: 0.75rem;
            font-weight: 700;
            transition: all 0.2s;
            display: inline-flex;
            background: var(--primary);
            color: var(--primary-foreground);
            cursor: pointer;
          }
          .salesops-root .primary-button:hover {
            background: #059669;
          }
          .salesops-root .status-dot {
            background: var(--primary);
            width: 0.5rem;
            height: 0.5rem;
            border-radius: 9999px;
            box-shadow: 0 0 0 0.25rem rgba(16, 185, 129, 0.15);
            display: inline-block;
          }
          .salesops-root .inventory-alert {
            border: 1px solid rgba(245, 158, 11, 0.4);
            background: rgba(245, 158, 11, 0.08);
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }
          @media (min-width: 1024px) {
            .salesops-root .inventory-alert {
              flex-direction: row;
              justify-content: space-between;
              align-items: center;
            }
          }
          .salesops-root .alert-icon {
            border: 1px solid rgba(245, 158, 11, 0.3);
            background: rgba(245, 158, 11, 0.1);
            color: var(--warning);
            width: 2.5rem;
            height: 2.5rem;
            display: inline-flex;
            justify-content: center;
            align-items: center;
          }
          .salesops-root .stock-tag {
            border: 1px solid rgba(245, 158, 11, 0.36);
            background: rgba(245, 158, 11, 0.1);
            color: var(--foreground);
            padding: 0.375rem 0.625rem;
            font-size: 11px;
            display: inline-flex;
            align-items: center;
          }
          .salesops-root .stock-tag b {
            color: var(--warning);
            margin-left: 0.3rem;
          }
          .salesops-root .stock-danger {
            border-color: rgba(239, 68, 68, 0.45);
            background: rgba(239, 68, 68, 0.1);
          }
          .salesops-root .stock-danger b {
            color: var(--destructive);
          }
          .salesops-root .status-tag {
            border: 1px solid rgba(16, 185, 129, 0.3);
            background: rgba(16, 185, 129, 0.1);
            color: var(--primary);
            padding: 0.375rem 0.625rem;
            font-size: 11px;
            display: inline-flex;
            align-items: center;
          }
          .salesops-root .status-blue {
            border-color: rgba(59, 130, 246, 0.35);
            background: rgba(59, 130, 246, 0.1);
            color: var(--chart-1);
          }
          .salesops-root .status-amber {
            border-color: rgba(245, 158, 11, 0.35);
            background: rgba(245, 158, 11, 0.1);
            color: var(--warning);
          }
          .salesops-root .sync-box {
            border: 1px solid var(--border);
            background: var(--secondary);
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
            padding: 0.875rem;
          }
          .salesops-root .sync-icon {
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid rgba(16, 185, 129, 0.3);
            width: 2rem;
            height: 2rem;
            color: var(--primary);
            display: inline-flex;
            justify-content: center;
            align-items: center;
          }
          .salesops-root .product-rank {
            width: 1.5rem;
            font-family: monospace;
            color: var(--muted-foreground);
            font-size: 10px;
          }
          .salesops-root .legend-dot {
            width: 0.5rem;
            height: 0.5rem;
            display: inline-block;
            border-radius: 9999px;
          }
        `}} />

        {/* ========================================================================= */}
        {/* 1. Header (Sticky SalesOps Navigation) */}
        {/* ========================================================================= */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl" style={{ backgroundColor: 'rgba(9, 13, 22, 0.95)', borderColor: '#1e293b' }}>
          <div className="mx-auto flex min-h-16 max-w-[1600px] flex-wrap items-center gap-4 px-4 py-3 sm:px-6 xl:px-8">
            <div className="flex shrink-0 items-center gap-3">
              <span className="brand-mark">
                <span></span>
                <span></span>
                <span></span>
              </span>
              <span className="hidden text-sm font-semibold tracking-tight sm:inline text-white">
                Flow Commerce <span style={{ color: '#10b981' }}>Pro</span>
              </span>
            </div>

            <nav className="order-3 flex w-full overflow-x-auto border border-border bg-card p-1 lg:order-none lg:mx-auto lg:w-auto" style={{ borderColor: '#1e293b', backgroundColor: '#0f172a' }}>
              <a
                href="/admin/analytics"
                className="shrink-0 px-4 py-2 text-xs font-medium transition"
                style={{ backgroundColor: '#10b981', color: '#022c22', fontWeight: 700 }}
              >
                Dashboard
              </a>
              <a
                href="/admin/collections/orders"
                className="shrink-0 px-4 py-2 text-xs font-medium transition text-slate-400 hover:text-white"
              >
                Pedidos Shopify
              </a>
              <a
                href="/admin/collections/products"
                className="shrink-0 px-4 py-2 text-xs font-medium transition text-slate-400 hover:text-white"
              >
                Productos
              </a>
              <a
                href="/admin/collections/customers"
                className="shrink-0 px-4 py-2 text-xs font-medium transition text-slate-400 hover:text-white"
              >
                Clientes CRM
              </a>
              <a
                href="/admin"
                className="shrink-0 px-4 py-2 text-xs font-medium transition text-slate-400 hover:text-white"
              >
                Colecciones
              </a>
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-2 border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:text-foreground md:flex"
                style={{ borderColor: '#1e293b', backgroundColor: '#0f172a', color: '#94a3b8' }}
              >
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono text-emerald-400 font-medium">{tenantSlug}</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <div
                className="flex items-center gap-2 border border-border bg-card p-1.5 pr-3"
                style={{ borderColor: '#1e293b', backgroundColor: '#0f172a' }}
              >
                <span className="avatar">{userInitials || 'AD'}</span>
                <span className="hidden text-left xl:block">
                  <span className="block text-xs font-medium text-white">{userName}</span>
                  <span className="block text-[10px]" style={{ color: '#10b981' }}>
                    {isSuperAdmin ? 'Super Admin' : 'Admin Tienda'}
                  </span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>

              <button
                className="border border-border bg-card p-2 text-muted-foreground hover:text-foreground"
                style={{ borderColor: '#1e293b', backgroundColor: '#0f172a', color: '#94a3b8' }}
              >
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
          <section className="hero-panel">
            <div className="relative flex flex-col justify-between gap-7 xl:flex-row xl:items-end">
              <div>
                <div className="mb-4 flex items-center gap-2 text-xs font-medium" style={{ color: '#10b981' }}>
                  <span className="status-dot"></span> Operación en línea · {dateTitle}
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Bienvenido/a, {userName}
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Panel de control y ventas para <span className="font-medium text-white">{tenantName}</span>
                  <span className="mx-2 text-slate-700">•</span>
                  Tasa BCV <span className="font-mono" style={{ color: '#10b981' }}>Bs. {rateVES.toFixed(2)} / $</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <a href="/admin/collections/products/create" className="action-button">
                  <Plus className="w-4 h-4" />
                  <span>Producto</span>
                </a>
                <a href="/admin/collections/orders" className="action-button">
                  <ClipboardList className="w-4 h-4" />
                  <span>Ver pedidos</span>
                </a>
                <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="primary-button">
                  <ShoppingBag className="w-4 h-4" />
                  <span>Abrir Tienda</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 3. 4 Key Metric Cards (SalesOps style) */}
          {/* ========================================================================= */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Ventas de hoy */}
            <article className="dashboard-panel group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400">Ventas de hoy</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-white">${todaySalesUSD.toFixed(2)}</p>
                </div>
                <span className="metric-icon">
                  <Wallet className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-slate-800/70 pt-3">
                <span className="font-mono text-[11px] text-slate-400">
                  Bs. {todaySalesVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] font-medium" style={{ color: '#10b981' }}>{todayOrders.length} hoy</span>
              </div>
            </article>

            {/* Card 2: Ventas acumuladas */}
            <article className="dashboard-panel group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400">Ventas acumuladas</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-white">${totalSalesUSD.toFixed(2)}</p>
                </div>
                <span className="metric-icon metric-blue">
                  <ShoppingCart className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-slate-800/70 pt-3">
                <span className="font-mono text-[11px] text-slate-400">
                  Bs. {totalSalesVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] font-medium" style={{ color: '#3b82f6' }}>{orders.length} órdenes</span>
              </div>
            </article>

            {/* Card 3: Clientes en CRM */}
            <article className="dashboard-panel group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400">Clientes en CRM</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{customers.length}</p>
                </div>
                <span className="metric-icon metric-amber">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-slate-800/70 pt-3">
                <span className="font-mono text-[11px] text-slate-400">
                  {vipCount} VIP · {recurrenteCount} recurrentes
                </span>
                <span className="text-[11px] font-medium" style={{ color: '#f59e0b' }}>+12% mes</span>
              </div>
            </article>

            {/* Card 4: Por despachar */}
            <article className="dashboard-panel group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400">Por despachar</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{pendingOrdersCount}</p>
                </div>
                <span className="metric-icon metric-cyan">
                  <Package className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-slate-800/70 pt-3">
                <span className="font-mono text-[11px] text-slate-400">{products.length} productos activos</span>
                <span className="text-[11px] font-medium" style={{ color: '#10b981' }}>
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
                  <TriangleAlert className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Alerta de inventario: {lowStockProducts.length} productos con stock crítico
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Reabastece pronto para evitar ventas perdidas.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {lowStockProducts.map((p) => (
                  <a
                    key={p.id}
                    href={`/admin/collections/products/${p.id}`}
                    className={`stock-tag ${p.stockQuantity === 0 ? 'stock-danger' : ''}`}
                  >
                    <span>{p.title}</span>
                    <b>{p.stockQuantity !== undefined ? `${p.stockQuantity} uds` : 'Agotado'}</b>
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
            <div className="dashboard-panel p-5">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: '#10b981' }}>
                    Rendimiento · últimos 7 días
                  </p>
                  <h2 className="text-lg font-semibold text-white">Ventas y pedidos</h2>
                </div>
                <a
                  href="/admin/collections/orders"
                  className="text-xs text-slate-400 transition hover:text-white"
                  style={{ color: '#94a3b8' }}
                >
                  Ver reporte →
                </a>
              </div>

              <div className="flex h-56 items-end gap-2 border-b border-l border-slate-800/70 px-2 pb-0 pt-5 sm:gap-4">
                {last7Days.map((bar, idx) => {
                  const heightPercent = Math.max(Math.round((bar.amount / maxDaySales) * 100), 8);
                  const isToday = idx === 6;
                  return (
                    <div key={bar.dateStr} className="flex h-full flex-1 flex-col items-center justify-end gap-2 group">
                      <div
                        className="w-full max-w-12 transition-all duration-300"
                        style={{
                          height: `${heightPercent}%`,
                          backgroundColor: isToday ? '#10b981' : bar.amount > 0 ? 'rgba(16, 185, 129, 0.7)' : '#1e293b',
                        }}
                      ></div>
                      <span className="font-mono text-[10px] text-slate-400">
                        {bar.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-5 text-[11px] text-slate-400">
                <span className="flex items-center gap-2">
                  <i className="legend-dot" style={{ backgroundColor: '#10b981' }}></i> Ventas ${totalSalesUSD.toFixed(0)}
                </span>
                <span className="flex items-center gap-2">
                  <i className="legend-dot" style={{ backgroundColor: '#3b82f6' }}></i> Pedidos {totalOrders}
                </span>
                <span className="ml-auto flex items-center gap-1" style={{ color: '#10b981' }}>
                  +18.4% vs. semana anterior <ArrowUpRight className="w-3.5 h-3.5 inline" />
                </span>
              </div>
            </div>

            {/* Más Vendidos (.8fr) */}
            <div className="dashboard-panel p-5">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: '#10b981' }}>
                    Catálogo
                  </p>
                  <h2 className="text-lg font-semibold text-white">Más vendidos</h2>
                </div>
                <a href="/admin/collections/products" className="text-xs text-slate-400 transition hover:text-white">
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
                          <p className="truncate text-xs font-medium text-white">{p.title}</p>
                          <div className="mt-2 h-1 bg-slate-800">
                            <div className="h-full" style={{ width: `${barPercent}%`, backgroundColor: '#3b82f6' }}></div>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">
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
          </section>

          {/* ========================================================================= */}
          {/* 6. Pedidos Recientes (Shopify Style) */}
          {/* ========================================================================= */}
          <section className="dashboard-panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: '#10b981' }}>
                  Shopify
                </p>
                <h2 className="text-lg font-semibold text-white">Pedidos recientes</h2>
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
              <p className="p-8 text-center text-xs text-slate-500">
                No hay pedidos registrados todavía en esta tienda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/40 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      <th className="px-5 py-3">Pedido</th>
                      <th className="px-5 py-3">Cliente</th>
                      <th className="px-5 py-3">Modalidad</th>
                      <th className="px-5 py-3">Total</th>
                      <th className="px-5 py-3">Estado</th>
                      <th className="px-5 py-3">Fecha</th>
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
                        <tr key={order.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                          <td className="px-5 py-4 font-mono font-medium" style={{ color: '#10b981' }}>
                            <a href={`/admin/collections/orders/${order.id}`} className="hover:underline">
                              #{orderNum}
                            </a>
                          </td>
                          <td className="px-5 py-4 font-medium text-white">{customerName}</td>
                          <td className="px-5 py-4 text-slate-400">
                            {order.deliveryType === 'delivery' ? 'Delivery Express' : 'Pick-up'}
                          </td>
                          <td className="px-5 py-4 font-mono text-white">${totalUSD.toFixed(2)}</td>
                          <td className="px-5 py-4">
                            {status === 'pending' && (
                              <span className="status-tag status-amber">Procesando</span>
                            )}
                            {status === 'preparing' && (
                              <span className="status-tag status-blue">Enviado</span>
                            )}
                            {status === 'delivered' && (
                              <span className="status-tag">Pagado</span>
                            )}
                            {status !== 'pending' && status !== 'preparing' && status !== 'delivered' && (
                              <span className="status-tag">{status}</span>
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
          <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
            {/* Mini CRM */}
            <div className="dashboard-panel p-5">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: '#10b981' }}>
                    Mini CRM
                  </p>
                  <h2 className="text-lg font-semibold text-white">Clientes recientes</h2>
                </div>
                <a href="/admin/collections/customers" className="text-xs text-slate-400 transition hover:text-white">
                  Abrir CRM →
                </a>
              </div>

              <div className="space-y-1">
                {categorizedCustomers.slice(0, 4).map((c, idx) => {
                  const phone = c.phone || '';
                  const cleanPhone = phone.replace(/\D/g, '');
                  const customerName = c.name || 'Cliente';
                  const initials = customerName.split(' ').map((n: string) => n.charAt(0)).join('').toUpperCase().slice(0, 2);
                  const avatarColor = idx === 0 ? '#00d2ef' : idx === 1 ? '#a685ff' : '#fcbb00';
                  const prefilledMsg = encodeURIComponent(`¡Hola ${customerName}! Te escribimos de ${tenantName}. ¿Cómo estás?`);

                  return (
                    <div key={c.id} className="flex items-center gap-3 border-b border-slate-800/60 py-3 last:border-0">
                      <span className="avatar" style={{ backgroundColor: avatarColor, color: '#000' }}>
                        {initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-white">{customerName}</p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {c.computedOrders} compras · {c.computedTier === 'vip' ? 'VIP' : c.computedTier === 'recurrente' ? 'Recurrente' : 'Nuevo'}
                        </p>
                      </div>
                      {cleanPhone ? (
                        <a
                          href={`https://wa.me/${cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone}`}?text=${prefilledMsg}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="action-button px-3 py-2 text-[11px]"
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
            <div className="dashboard-panel p-5">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: '#10b981' }}>
                    Integración
                  </p>
                  <h2 className="text-lg font-semibold text-white">Google Sheets</h2>
                  <p className="mt-2 max-w-sm text-xs leading-5 text-slate-400">
                    Mantén tu catálogo sincronizado con una hoja de cálculo central.
                  </p>
                </div>
                <FileSpreadsheet className="w-6 h-6" style={{ color: '#10b981' }} />
              </div>

              <div className="sync-box">
                <div className="flex items-center gap-3">
                  <span className="sync-icon">
                    <Check className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-white">Catálogo conectado</p>
                    <p className="mt-1 text-[10px] text-slate-400">Sincronización instantánea</p>
                  </div>
                </div>
                <div className="w-full mt-2">
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

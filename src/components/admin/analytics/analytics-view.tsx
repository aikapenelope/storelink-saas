import React from 'react';
import Link from 'next/link';
import { getPayload } from 'payload';
import config from '@payload-config';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Store, ExternalLink } from 'lucide-react';
import { ExchangeRateControl } from '@/components/admin/ExchangeRateControl';
import { DashboardOrdersManager } from '@/components/admin/DashboardOrdersManager';
import { JobsStatusView } from '@/components/admin/JobsStatusView';
import { getAllLiveExchangeRates, resolveExchangeRateVES } from '@/lib/exchange-rate';
import { getOrderKpis, getSalesSeries } from '@/lib/analytics';
import { fetchOrdersPage } from '@/app/actions/admin-orders';
import { isSuperAdmin, getUserTenantIds } from '@/lib/utils';
import type { Tenant, User, Order, Product } from '@/payload-types';
import type { Where } from 'payload';
import { ThemeBridge } from './theme-bridge';
import { HeroPanel } from './hero-panel';
import { KpiCards } from './kpi-cards';
import { LowStockAlert } from './low-stock-alert';
import { SalesChartCard } from './sales-chart-card';
import { BestSellersCard } from './best-sellers-card';
import { BottomGrid } from './bottom-grid';

/**
 * PR 2/5 (plan Analytics+CRM shadcn): vista /admin/analytics migrada a
 * shadcn. El orquestador de datos preserva TEXTUAL la seguridad del
 * AnalyticsView original (redirect login L38-40, guard de tenant sin asignar,
 * fallback de super-admin sin tenant) — doc oficial: las custom views son
 * públicas por defecto y el blindaje es responsabilidad de la vista.
 * La presentación se reparte en módulos feature-parity sección por sección.
 */
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
      tenantDoc = (await payload
        .findByID({ collection: 'tenants', id: tenantId as number })
        .catch(() => null)) as Tenant | null;
    }

    if (!isSuperAdminUser && !tenantDoc) {
      return (
        <ThemeBridge>
          <div className="min-h-screen bg-background p-12 text-center font-sans text-muted-foreground">
            <div className="mx-auto max-w-md rounded-none border border-border bg-card p-6 shadow-2xl">
              <h3 className="mb-2 text-lg font-bold text-foreground">Tienda no asignada</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Tu cuenta de usuario todavía no tiene una tienda asignada. Contacta al
                administrador de la plataforma para vincular tu comercio.
              </p>
            </div>
          </div>
        </ThemeBridge>
      );
    }

    // Super-admin sin tenant propio: usar el primero disponible en la plataforma
    // como contexto para los widgets (exchange-rate, storefront URL).
    let defaultTenantSlug = '';
    if (!tenantDoc && isSuperAdminUser) {
      const firstTenantRes = await payload.find({ collection: 'tenants', limit: 1 });
      if (firstTenantRes.docs.length > 0) {
        defaultTenantSlug = firstTenantRes.docs[0].slug;
      }
    }

    const tenantSlug = tenantDoc?.slug || defaultTenantSlug;
    const tenantName =
      tenantDoc?.name || (isSuperAdminUser ? 'Plataforma Global (Todas las Tiendas)' : 'Mi Tienda');
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://flow.martes.app';
    const storeUrl = `${siteUrl}/${tenantSlug}`;
    const userName = typedUser.email ? typedUser.email.split('@')[0] : 'Comerciante';

    const liveRates = await getAllLiveExchangeRates();
    const customRate = tenantDoc?.branding?.exchangeRateVES
      ? Number(tenantDoc.branding.exchangeRateVES)
      : null;
    const { rate: rateVES, source: rateSource } = await resolveExchangeRateVES(tenantDoc);

    const tenantFilter: Where | undefined = tenantId
      ? { tenant: { equals: tenantId } }
      : undefined;

    const [ordersRes, customersRes, productsCountRes, lowStockRes, kpis, series30, bestSellers] =
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
          depth: 0,
        }),
        payload.count({
          collection: 'products',
          ...(tenantFilter ? { where: tenantFilter } : {}),
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
          depth: 0,
        }),
        getOrderKpis(payload, tenantId),
        getSalesSeries(payload, tenantId, 30),
        (await import('@/lib/analytics')).getBestSellers(payload, tenantId, 5),
      ]);

    const orders = (ordersRes.docs || []) as Order[];
    const customers = customersRes.docs as Array<{
      id: number | string;
      name: string | null;
      phone: string | null;
      totalOrders?: number | null;
      totalSpent?: number | null;
      tag?: string | null;
    }>;
    const totalProducts = productsCountRes.totalDocs;
    const lowStockProducts = (lowStockRes.docs || []) as Product[];

    const totalOrders = kpis.orderCount;
    const totalSalesUSD = kpis.totalUSD;
    const totalSalesVES = rateVES ? totalSalesUSD * rateVES : 0;
    const todaySalesUSD = kpis.todayUSD;
    const todaySalesVES = rateVES ? todaySalesUSD * rateVES : 0;
    const todayOrdersCount = kpis.todayOrderCount;
    const pendingOrdersCount = kpis.pendingCount;

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const dateTitle = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);

    // Categorized CRM (misma regla del original)
    const categorizedCustomers = customers.map((c) => {
      const customerOrders = Number(c.totalOrders) || 1;
      const totalSpent = Number(c.totalSpent) || 0;
      let tier: 'vip' | 'recurrente' | 'nuevo' = 'nuevo';
      if (customerOrders >= 3 || totalSpent >= 50 || c.tag === 'vip') {
        tier = 'vip';
      } else if (customerOrders === 2 || c.tag === 'frecuente') {
        tier = 'recurrente';
      }
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        computedOrders: customerOrders,
        computedTier: tier,
      };
    });

    const vipCount = categorizedCustomers.filter((c) => c.computedTier === 'vip').length;
    const recurrenteCount = categorizedCustomers.filter(
      (c) => c.computedTier === 'recurrente'
    ).length;

    const userInitials = userName
      .split(' ')
      .map((n: string) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <ThemeBridge>
        <div className="min-h-screen bg-background font-sans antialiased text-foreground selection:bg-foreground selection:text-background">
          {/* Header */}
          <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
            <div className="mx-auto flex min-h-14 max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-2.5 sm:px-6 xl:px-8">
              <div className="flex shrink-0 items-center gap-3">
                <span className="flex w-5 flex-col gap-1">
                  <span className="h-0.5 w-full bg-foreground"></span>
                  <span className="ml-1 h-0.5 w-3.5 bg-muted-foreground/60"></span>
                  <span className="ml-2 h-0.5 w-2 bg-muted-foreground/30"></span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-extrabold uppercase tracking-tight text-foreground">
                    Flow
                  </span>
                  <span className="border-l border-border pl-2 font-mono text-[11px] text-muted-foreground">
                    by <strong className="font-semibold text-foreground">martes.app</strong>
                  </span>
                </div>
              </div>

              <nav className="order-3 flex w-full overflow-x-auto rounded-none border border-border bg-card p-0.5 lg:order-none lg:mx-auto lg:w-auto">
                <Link
                  href="/admin/analytics"
                  className="shrink-0 rounded-none bg-foreground px-3.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-background shadow-sm"
                >
                  Dashboard
                </Link>
                {[
                  { href: '/admin/collections/orders', label: 'Pedidos' },
                  { href: '/admin/collections/products', label: 'Productos' },
                  { href: '/admin/collections/customers', label: 'Clientes CRM' },
                  { href: '/admin', label: 'Colecciones' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="shrink-0 rounded-none px-3.5 py-1 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="flex items-center gap-2.5">
                {tenantSlug ? (
                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden items-center gap-2 rounded-none border border-border bg-muted px-3 py-1 font-mono text-xs text-muted-foreground transition hover:border-foreground/40 hover:text-foreground md:flex"
                  >
                    <Store className="size-3.5 shrink-0" />
                    <span>/{tenantSlug}</span>
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                ) : null}

                <div className="flex items-center gap-2 rounded-none border border-border bg-muted p-1 pr-3">
                  <span className="flex size-6 shrink-0 items-center justify-center bg-foreground font-mono text-xs font-extrabold text-background">
                    {userInitials || 'AD'}
                  </span>
                  <span className="hidden text-left xl:block">
                    <span className="block text-xs font-bold leading-tight text-foreground">
                      {userName}
                    </span>
                    <span className="block font-mono text-[9px] text-muted-foreground">
                      {isSuperAdminUser ? 'SUPER ADMIN' : 'TIENDA ADMIN'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 xl:px-8">
            <HeroPanel
              tenantName={tenantName}
              dateTitle={dateTitle}
              rateVES={rateVES}
              rateSource={rateSource}
              tenantSlug={tenantSlug}
              storeUrl={storeUrl}
            />

            <KpiCards
              todaySalesUSD={todaySalesUSD}
              todaySalesVES={todaySalesVES}
              todayOrdersCount={todayOrdersCount}
              totalSalesUSD={totalSalesUSD}
              totalSalesVES={totalSalesVES}
              totalOrders={totalOrders}
              customerCount={kpis.customerCount}
              vipCount={vipCount}
              recurrenteCount={recurrenteCount}
              pendingOrdersCount={pendingOrdersCount}
              totalProducts={totalProducts}
              rateVES={rateVES}
            />

            <section>
              <JobsStatusView />
            </section>

            <section>
              <ExchangeRateControl
                tenantSlug={tenantSlug}
                tenantName={tenantName}
                initialCustomRate={customRate}
                liveRates={liveRates}
              />
            </section>

            <LowStockAlert products={lowStockProducts} />

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

            <section className="grid gap-4 xl:grid-cols-[1.4fr_.8fr]">
              <SalesChartCard
                series30={series30}
                totalSalesUSD={totalSalesUSD}
                totalOrders={totalOrders}
              />
              <BestSellersCard bestSellers={bestSellers} />
            </section>

            <BottomGrid
              customers={categorizedCustomers}
              tenantName={tenantName}
              tenantSlug={tenantSlug}
            />
          </main>
        </div>
      </ThemeBridge>
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return (
      <ThemeBridge>
        <div className="min-h-screen bg-background p-8 text-center font-sans text-muted-foreground">
          <p>Error cargando analíticas: {msg}</p>
        </div>
      </ThemeBridge>
    );
  }
}

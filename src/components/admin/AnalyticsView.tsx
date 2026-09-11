import React from 'react';
import { getPayload } from 'payload';
import config from '@payload-config';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAllLiveExchangeRates, resolveExchangeRateVES } from '@/lib/exchange-rate';
import { getOrderKpis, getSalesSeries, getBestSellers, getCustomerKpis } from '@/lib/analytics';
import { isSuperAdmin, getUserTenantIds } from '@/lib/utils';
import type { Tenant, User, Order, Customer, Product } from '@/payload-types';
import type { Where } from 'payload';
import { JobsStatusView } from './JobsStatusView';
import { AnalyticsDashboardClient } from './AnalyticsDashboardClient';

export interface AnalyticsViewProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}

export async function AnalyticsView(props?: AnalyticsViewProps) {
  const headersList = await headers();
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: headersList });

  if (!user) {
    redirect('/admin/login?redirect=%2Fadmin%2Fanalytics');
  }

  let initialTab: 'performance' | 'customers' = 'performance';
  if (props?.searchParams) {
    try {
      const sp = await props.searchParams;
      if (sp && sp.tab === 'customers') {
        initialTab = 'customers';
      }
    } catch {
      // Si falla resolver searchParams, fallback seguro a 'performance'
      initialTab = 'performance';
    }
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

    // Super-admin sin tenant propio: usar el primero disponible en la plataforma
    // como contexto para los widgets (exchange-rate, storefront URL).
    let defaultTenantSlug = '';
    let defaultTenantId: number | string = 0;
    if (!tenantDoc && isSuperAdminUser) {
      const firstTenantRes = await payload.find({ collection: 'tenants', limit: 1 });
      if (firstTenantRes.docs.length > 0) {
        defaultTenantSlug = firstTenantRes.docs[0].slug;
        defaultTenantId = firstTenantRes.docs[0].id;
      }
    }

    const tenantSlug = tenantDoc?.slug || defaultTenantSlug;
    const tenantName = tenantDoc?.name || (isSuperAdminUser ? 'Plataforma Global (Todas las Tiendas)' : 'Mi Tienda');
    const effectiveTenantId = tenantDoc?.id || tenantId || defaultTenantId;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://flow.martes.app';
    const storeUrl = `${siteUrl}/${tenantSlug}`;
    const userName = typedUser.email ? typedUser.email.split('@')[0] : 'Comerciante';

    // Fetch live market exchange rates (solo informativo para el widget)
    const liveRates = await getAllLiveExchangeRates();
    const customRate = tenantDoc?.branding?.exchangeRateVES
      ? Number(tenantDoc.branding.exchangeRateVES)
      : null;
    // Tasa activa: manual > Binance en vivo > dólar paralelo > ninguna
    const { rate: rateVES, source: rateSource } = await resolveExchangeRateVES(tenantDoc);

    const tenantFilter: Where | undefined = tenantId ? { tenant: { equals: tenantId } } : undefined;

    // Carga concurrente SSR de órdenes, productos, clientes y KPIs
    const [
      ordersRes,
      customersRes,
      productsCountRes,
      lowStockRes,
      kpis,
      series14,
      bestSellers,
      customerKpis,
    ] = await Promise.all([
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
        limit: 25,
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
      getSalesSeries(payload, tenantId, 14),
      getBestSellers(payload, tenantId, 5),
      getCustomerKpis(payload, tenantId),
    ]);

    const orders = (ordersRes.docs || []) as Order[];
    const customers = (customersRes.docs || []) as Customer[];
    const totalProducts = productsCountRes.totalDocs;
    const lowStockProducts = (lowStockRes.docs || []) as Product[];

    // 1. Métricas Financieras (agregadas en SQL nativo)
    const totalOrders = kpis.orderCount;
    const totalSalesUSD = kpis.totalUSD;
    const totalSalesVES = rateVES ? totalSalesUSD * rateVES : 0;
    const todaySalesUSD = kpis.todayUSD;
    const todaySalesVES = rateVES ? todaySalesUSD * rateVES : 0;
    const todayOrdersCount = kpis.todayOrderCount;
    const pendingOrdersCount = kpis.pendingCount;

    // Formateo de fecha en español
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const dateTitle = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);

    // 2. Tendencia de 7 días + % vs semana previa
    const last7Days = series14.slice(7);
    const currentWeekTotal = last7Days.reduce((acc, d) => acc + d.amount, 0);
    const prevWeekTotal = series14.slice(0, 7).reduce((acc, d) => acc + d.amount, 0);
    const changePct = prevWeekTotal > 0 ? ((currentWeekTotal - prevWeekTotal) / prevWeekTotal) * 100 : null;
    const maxDaySales = Math.max(...last7Days.map((d) => d.amount), 1);

    // 3. Más Vendidos (agregado en SQL)
    const top5Products = bestSellers;
    const maxProductUnits = Math.max(...top5Products.map((p) => p.units), 1);

    // 4. CRM Categorizado (para el widget Mini CRM en pestaña Rendimiento)
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

    // Iniciales de usuario para avatar
    const userInitials = userName
      .split(' ')
      .map((n: string) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <AnalyticsDashboardClient
        initialTab={initialTab}
        userName={userName}
        userInitials={userInitials}
        isSuperAdminUser={isSuperAdminUser}
        tenantSlug={tenantSlug}
        tenantName={tenantName}
        storeUrl={storeUrl}
        tenantId={effectiveTenantId}
        dateTitle={dateTitle}
        rateVES={rateVES ?? 0}
        rateSource={rateSource}
        customRate={customRate}
        liveRates={liveRates}
        todaySalesUSD={todaySalesUSD}
        todaySalesVES={todaySalesVES}
        todayOrdersCount={todayOrdersCount}
        totalSalesUSD={totalSalesUSD}
        totalSalesVES={totalSalesVES}
        totalOrders={totalOrders}
        pendingOrdersCount={pendingOrdersCount}
        totalProducts={totalProducts}
        lowStockProducts={lowStockProducts}
        initialOrders={orders}
        last7Days={last7Days}
        changePct={changePct}
        maxDaySales={maxDaySales}
        top5Products={top5Products}
        maxProductUnits={maxProductUnits}
        categorizedCustomers={categorizedCustomers}
        initialCustomers={customers}
        customerKpis={customerKpis}
        jobsStatusView={<JobsStatusView />}
      />
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

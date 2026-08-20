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
  CreditCard,
  PlusCircle,
  Image as ImageIcon,
  Settings,
  Sparkles,
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

      const totalRevenueUSD = ordersRes.docs.reduce((acc, o: any) => acc + (Number(o.total) || 0), 0);

      return (
        <div className="w-full mb-8 space-y-6 animate-in fade-in duration-300">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 border border-slate-700 shadow-2xl relative overflow-hidden">
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
                  Gestiona todos los comercios, catálogos e infraestructura de <span className="text-emerald-400 font-semibold">martes.app</span>.
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
    // MERCHANT (TENANT-ADMIN) VIEW: Tailored Store & Mini CRM
    // -------------------------------------------------------------
    // Determine tenant ID from user relationship or user object
    let tenantId: number | string | null = null;

    if ((user as any)?.tenants && Array.isArray((user as any).tenants) && (user as any).tenants.length > 0) {
      const rawTenant = (user as any).tenants[0].tenant;
      tenantId = typeof rawTenant === 'object' && rawTenant !== null ? rawTenant.id : rawTenant;
    }

    // If no tenant attached directly, query the first tenant or fallback
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

    // Fetch tenant-specific data concurrently
    const todayStr = new Date().toISOString().split('T')[0];

    const [ordersRes, customersRes, productsRes] = await Promise.all([
      payload.find({
        collection: 'orders',
        where: { tenant: { equals: tenantId } },
        limit: 50,
        sort: '-createdAt',
      }),
      payload.find({
        collection: 'customers',
        where: { tenant: { equals: tenantId } },
        limit: 20,
        sort: '-updatedAt',
      }),
      payload.find({
        collection: 'products',
        where: { tenant: { equals: tenantId } },
        limit: 1,
      }),
    ]);

    const orders = ordersRes.docs as any[];
    const customers = customersRes.docs as any[];
    const totalProducts = productsRes.totalDocs || 0;

    // Compute Metrics
    const totalSalesUSD = orders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    const totalSalesVES = totalSalesUSD * rateVES;

    const todayOrders = orders.filter((o) => o.createdAt && o.createdAt.startsWith(todayStr));
    const todaySalesUSD = todayOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    const todaySalesVES = todaySalesUSD * rateVES;

    const pendingOrdersCount = orders.filter(
      (o) => !o.status || o.status === 'pending' || o.status === 'processing'
    ).length;

    // Compute customer order frequencies for VIP tagging
    const customerOrderCounts = new Map<string, number>();
    orders.forEach((o) => {
      const phone = o.customerPhone || o.customer?.phone;
      if (phone) {
        customerOrderCounts.set(phone, (customerOrderCounts.get(phone) || 0) + 1);
      }
    });

    const vipCustomersCount = Array.from(customerOrderCounts.values()).filter((c) => c >= 2).length;

    return (
      <div className="w-full mb-8 space-y-6 animate-in fade-in duration-300 font-sans">
        {/* 1. Store Header & Live URL Card */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 border border-slate-700/80 shadow-2xl relative overflow-hidden">
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
                <span>URL Pública:</span>
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-emerald-400 hover:text-emerald-300 underline font-semibold flex items-center gap-1"
                >
                  <span>{tenantSlug}.martes.app</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>

            {/* Quick Action Buttons */}
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

        {/* 2. Key Metrics Grid (KPIs) */}
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
              <span className="text-[10px] text-emerald-600 font-semibold">{todayOrders.length} pedidos</span>
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

          {/* Card 3: Clientes Registrados & VIP */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Clientes & VIP
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
                {vipCustomersCount} Clientes VIP
              </span>
              <span className="text-[10px] text-slate-400">Mini CRM</span>
            </div>
          </div>

          {/* Card 4: Catálogo e Inventario */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Catálogo Activo
                </span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {totalProducts}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span>{pendingOrdersCount} pedidos por entregar</span>
              <span className="text-[10px] text-emerald-600 font-bold">En Línea</span>
            </div>
          </div>
        </div>

        {/* 3. Google Sheets Quick Sync Bar */}
        <GoogleSheetsSyncWidget tenantSlug={tenantSlug} tenantName={tenantName} />

        {/* 4. Mini CRM (Clientes con Badges VIP & WhatsApp Directo) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Mini CRM: Compradores Recientes & Fidelización
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {customers.length} compradores registrados
            </span>
          </div>

          {customers.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center font-medium">
              Aún no hay clientes registrados. Aparecerán automáticamente al recibir pedidos en la tienda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Teléfono WhatsApp</th>
                    <th className="py-2.5 px-3">Frecuencia / Estatus</th>
                    <th className="py-2.5 px-3">Ubicación Frecuente</th>
                    <th className="py-2.5 px-3 text-right">Contacto Rápido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {customers.slice(0, 8).map((c) => {
                    const phone = c.phone || '';
                    const cleanPhone = phone.replace(/\D/g, '');
                    const purchaseCount = customerOrderCounts.get(phone) || (c.savedAddresses?.length || 1);
                    const isVIP = purchaseCount >= 2;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                          {c.name || 'Cliente Sin Nombre'}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                          {phone || '—'}
                        </td>
                        <td className="py-3 px-3">
                          {isVIP ? (
                            <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-black text-[10px] px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                              <Crown className="w-3 h-3" />
                              ⭐ Cliente VIP ({purchaseCount} compras)
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                              Recurrente ({purchaseCount} compras)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400 font-medium truncate max-w-[200px]">
                          {c.savedAddresses && c.savedAddresses.length > 0
                            ? `${c.savedAddresses[0].municipality || ''} ${c.savedAddresses[0].address || ''}`.trim() || 'Caracas'
                            : '—'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {cleanPhone ? (
                            <a
                              href={`https://wa.me/${cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone}`}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-lg text-[11px] font-bold transition border border-emerald-200 dark:border-emerald-800"
                            >
                              <Phone className="w-3 h-3" />
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

        {/* 5. Recent Orders Quick List */}
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
            <p className="text-xs text-slate-500 py-4 text-center font-medium">
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
                    <th className="py-2.5 px-3">Total (USD / VES)</th>
                    <th className="py-2.5 px-3 text-right">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {orders.slice(0, 6).map((o) => {
                    const totalUSD = Number(o.total) || 0;
                    const totalVES = totalUSD * rateVES;
                    const isDelivery = o.deliveryType === 'delivery';

                    return (
                      <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          #{o.id}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">
                            {o.customerName || 'Cliente'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {o.customerPhone || ''}
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
                            {o.paymentMethodKey ? o.paymentMethodKey.replace('_', ' ') : 'WhatsApp'}
                          </span>
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
                            <span>Ver</span>
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

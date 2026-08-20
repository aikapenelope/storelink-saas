'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'iconify-icon': React.DetailedHTMLProps<
          React.HTMLAttributes<HTMLElement> & {
            icon?: string;
            width?: string | number;
            height?: string | number;
            inline?: boolean;
          },
          HTMLElement
        >;
      }
    }
  }
}

export default function FlowLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState('2026');

  useEffect(() => {
    setCurrentYear(new Date().getFullYear().toString());
  }, []);

  return (
    <div className="overflow-x-hidden bg-[#0c0418] text-slate-950 antialiased selection:bg-violet-500 selection:text-white font-sans">
      {/* ========================================================================= */}
      {/* HERO SECTION                                                              */}
      {/* ========================================================================= */}
      <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-white via-[#f0eaff] to-[#7C3AED]">
        {/* Ambient Glows */}
        <div className="pointer-events-none absolute left-1/2 top-20 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-white/90 blur-3xl"></div>
        <div className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-fuchsia-300/30 blur-3xl"></div>
        <div className="pointer-events-none absolute -right-24 top-1/2 h-96 w-96 rounded-full bg-indigo-400/40 blur-3xl"></div>

        {/* Navigation */}
        <nav className="relative z-50 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8">
          <Link href="#inicio" className="flex items-center gap-2.5" aria-label="Flow by Martes, inicio">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED] text-white shadow-lg shadow-violet-500/30 ring-2 ring-white/70">
              <iconify-icon icon="solar:bolt-bold-duotone" width="24" height="24"></iconify-icon>
            </span>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-slate-950">Flow</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700">by Martes</span>
            </div>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-semibold text-slate-700 md:flex">
            <a href="#como-funciona" className="transition hover:text-[#7C3AED]">Cómo funciona</a>
            <a href="#todo-en-uno" className="transition hover:text-[#7C3AED]">Qué incluye</a>
            <a href="#catalogo-demo" className="transition hover:text-[#7C3AED]">Catálogo E-commerce</a>
            <a href="#control" className="transition hover:text-[#7C3AED]">Tu control</a>
            <a href="#precio" className="transition hover:text-[#7C3AED]">Precios</a>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/15 bg-white/90 px-4 py-2 text-xs font-extrabold text-slate-900 shadow-sm backdrop-blur transition hover:bg-slate-950 hover:text-white"
            >
              <iconify-icon icon="solar:user-bold" width="14" height="14"></iconify-icon>
              <span>Login Panel</span>
            </Link>

            <a
              href="#diagnostico"
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-xs font-bold text-white shadow-xl shadow-slate-950/20 transition duration-200 hover:-translate-y-0.5 hover:bg-[#7C3AED]"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Diagnóstico con IA al instante
            </a>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-900/10 bg-white/80 text-slate-900 shadow-sm backdrop-blur md:hidden"
            aria-label="Abrir menú"
          >
            <iconify-icon icon={mobileMenuOpen ? "solar:close-circle-bold" : "solar:hamburger-menu-linear"} width="22" height="22" style={{ strokeWidth: 1.5 }}></iconify-icon>
          </button>
        </nav>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="relative z-50 mx-5 rounded-2xl border border-white/60 bg-white/95 p-5 shadow-2xl backdrop-blur-lg md:hidden">
            <div className="flex flex-col gap-1 text-sm font-semibold text-slate-800">
              <a href="#como-funciona" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-violet-50">Cómo funciona</a>
              <a href="#todo-en-uno" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-violet-50">Qué incluye</a>
              <a href="#catalogo-demo" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-violet-50">Catálogo E-commerce</a>
              <a href="#control" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-violet-50">Tu control</a>
              <a href="#precio" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-violet-50">Precios</a>
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-violet-100 px-4 py-3 text-center font-bold text-[#7C3AED]"
              >
                <iconify-icon icon="solar:user-bold" width="16" height="16"></iconify-icon>
                <span>Login Panel</span>
              </Link>
              <a
                href="#diagnostico"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3.5 text-center font-bold text-white shadow-lg"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                Diagnóstico con IA al instante
              </a>
            </div>
          </div>
        )}

        {/* Hero Main Content */}
        <main id="inicio" className="relative z-20 mx-auto flex max-w-7xl flex-col items-center px-5 pb-28 pt-12 text-center md:px-8 md:pb-36 md:pt-20">
          {/* Top Badge */}
          <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-violet-300 bg-white/80 px-4 py-1.5 text-xs font-bold text-violet-900 shadow-sm backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            Tecnología con Estándar de Estados Unidos · Automatización Total
          </div>

          {/* Main Headline */}
          <h1 className="max-w-5xl text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
            Tu negocio vendiendo 24/7 en piloto automático.<br />
            <span className="bg-gradient-to-r from-[#7C3AED] via-violet-600 to-indigo-600 bg-clip-text text-transparent">
              Automatización definitiva para tus ventas.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-7 max-w-3xl text-base font-normal leading-relaxed text-slate-700 sm:text-lg md:text-xl">
            No se trata de que estés haciendo las cosas mal: estás bien, pero con Flow desbloqueas una productividad y escala masiva. Respuestas instantáneas por WhatsApp e Instagram con IA, e-commerce de grado internacional que procesa ventas de punta a punta y <strong>0% comisiones</strong>. Todo mientras te enfocas en crecer.
          </p>

          {/* CTA Buttons */}
          <div className="mt-9 flex w-full flex-col items-center justify-center gap-3.5 sm:w-auto sm:flex-row">
            <a
              href="#diagnostico"
              className="group inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-slate-950 px-7 py-4 text-sm font-bold text-white shadow-2xl shadow-violet-950/30 transition duration-200 hover:-translate-y-0.5 hover:bg-[#7C3AED] sm:w-auto"
            >
              Diagnóstico con IA al instante
              <iconify-icon icon="solar:arrow-right-linear" width="18" height="18" className="transition group-hover:translate-x-1" style={{ strokeWidth: 2 }}></iconify-icon>
            </a>
            <a
              href="#catalogo-demo"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-900/15 bg-white/90 px-6 py-4 text-sm font-bold text-slate-800 shadow-sm backdrop-blur transition hover:bg-white sm:w-auto"
            >
              <iconify-icon icon="solar:eye-bold" width="18" height="18" className="text-violet-600"></iconify-icon>
              Probar catálogo interactivo
            </a>
          </div>

          {/* Trust Badges */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <iconify-icon icon="solar:shield-check-bold" width="16" height="16" className="text-emerald-600"></iconify-icon>
              0% de comisión por venta
            </span>
            <span className="flex items-center gap-1.5">
              <iconify-icon icon="solar:bolt-circle-bold" width="16" height="16" className="text-violet-600"></iconify-icon>
              Auditoría de 5 minutos en WhatsApp/Instagram
            </span>
            <span className="flex items-center gap-1.5">
              <iconify-icon icon="solar:card-2-bold" width="16" height="16" className="text-indigo-600"></iconify-icon>
              Sin tarjeta de crédito
            </span>
          </div>

          {/* ========================================================================= */}
          {/* FLOATING CONVERSATION CARDS (Payload Black-on-Black Style)                */}
          {/* ========================================================================= */}
          
          {/* Floating Card 1: Top Left (WhatsApp Live Sale) */}
          <div className="animate-float-1 pointer-events-none absolute left-0 top-[42%] hidden w-80 rounded-2xl border border-neutral-800 bg-black/90 p-4 text-left shadow-2xl shadow-black/80 backdrop-blur-xl lg:block z-30 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 shadow-md">
                  <iconify-icon icon="logos:whatsapp-icon" width="20" height="20"></iconify-icon>
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Venta atendida en automático</p>
                  <p className="text-[10px] text-neutral-400 font-mono">Hoy, 2:14 a. m. · Chacao</p>
                </div>
              </div>
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <p className="mt-3 rounded-xl bg-neutral-900/90 p-3 text-xs leading-relaxed text-neutral-200 font-medium border border-neutral-800">
              “Listo Carlos, tu combo Don Luigi ya está reservado y el delivery coordinado. Total: $24.50”
            </p>
          </div>

          {/* Floating Card 2: Top Right (Conversion Metrics) */}
          <div className="animate-float-2 pointer-events-none absolute right-0 top-[38%] hidden w-72 rounded-2xl border border-neutral-800 bg-black/90 p-4 text-left shadow-2xl shadow-black/80 backdrop-blur-xl lg:block z-30 text-white">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold text-white">Ventas de Madrugada</p>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">+340%</span>
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight text-white font-mono">48 pedidos</p>
            <p className="text-[11px] text-neutral-400 font-medium">Atendidos en paralelo sin colas</p>
            <div className="mt-3 flex h-9 items-end gap-1.5">
              <span className="h-3 w-full rounded-sm bg-neutral-800"></span>
              <span className="h-5 w-full rounded-sm bg-neutral-700"></span>
              <span className="h-7 w-full rounded-sm bg-neutral-600"></span>
              <span className="h-9 w-full rounded-sm bg-[#7C3AED]"></span>
              <span className="h-6 w-full rounded-sm bg-indigo-500"></span>
            </div>
          </div>

          {/* Floating Card 3: Mid-Bottom Left (Instagram DM Lead) */}
          <div className="animate-float-3 pointer-events-none absolute -left-4 bottom-24 hidden w-72 rounded-2xl border border-neutral-800 bg-black/90 p-3.5 text-left shadow-2xl shadow-black/80 backdrop-blur-xl xl:block z-30 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-fuchsia-600 to-purple-600 text-white shadow-md">
                <iconify-icon icon="skill-icons:instagram" width="18" height="18"></iconify-icon>
              </div>
              <div>
                <p className="text-xs font-bold text-white">Instagram DM · @martes.app</p>
                <p className="text-[10px] text-emerald-400 font-semibold">Catálogo enviado en 1.2s</p>
              </div>
            </div>
          </div>

          {/* Floating Card 4: Mid-Bottom Right (Pago Móvil Verified) */}
          <div className="animate-float-4 pointer-events-none absolute -right-4 bottom-28 hidden w-72 rounded-2xl border border-neutral-800 bg-black/90 p-3.5 text-left shadow-2xl shadow-black/80 backdrop-blur-xl xl:block z-30 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <iconify-icon icon="solar:verified-check-bold" width="20" height="20"></iconify-icon>
              </div>
              <div>
                <p className="text-xs font-bold text-white">Pago Móvil Confirmado</p>
                <p className="text-[10px] text-neutral-400 font-mono">Bs. 1.715 · #ORD-104 Entregado</p>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* COMPACT CRM-STYLE DASHBOARD (Payload CMS Pure Black-on-Black Contrast)    */}
          {/* ========================================================================= */}
          <div className="mt-14 w-full max-w-5xl rounded-2xl border border-neutral-800 bg-black/90 p-2 shadow-2xl shadow-black/90 backdrop-blur-2xl md:p-3 relative z-20">
            <div className="overflow-hidden rounded-xl border border-neutral-800 bg-[#000000] text-left text-white shadow-2xl">
              {/* Top Bar (Payload Style) */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 bg-[#0a0a0a] px-4 py-2.5 sm:px-5">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-white text-black font-black text-[11px]">FL</span>
                  <span className="font-extrabold text-white">Flow by Martes</span>
                  <span className="text-neutral-600">/</span>
                  <span className="font-bold text-emerald-400">Don Luigi & Burgers</span>
                  <span className="hidden sm:inline-block rounded bg-neutral-900 px-2 py-0.5 text-[10px] font-mono text-neutral-300 border border-neutral-800">donluigi.martes.app</span>
                </div>

                {/* Quick Action Bar */}
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <a href="/don-luigi" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded bg-white px-3 py-1 text-black hover:bg-neutral-200 transition shadow-sm text-[11px] font-bold">
                    <iconify-icon icon="solar:shop-2-bold" width="13" height="13"></iconify-icon>
                    <span>Ver Tienda PWA</span>
                  </a>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded bg-neutral-900 px-2.5 py-1 text-neutral-200 hover:bg-neutral-800 border border-neutral-800 transition cursor-pointer text-[11px]">
                    <iconify-icon icon="solar:add-circle-bold" width="13" height="13" className="text-emerald-400"></iconify-icon>
                    + Producto
                  </span>
                  <span className="hidden md:inline-flex items-center gap-1 rounded bg-neutral-900 px-2.5 py-1 text-neutral-200 hover:bg-neutral-800 border border-neutral-800 transition cursor-pointer text-[11px]">
                    <iconify-icon icon="logos:google-sheets" width="12" height="12"></iconify-icon>
                    Sheets Sync
                  </span>
                </div>
              </div>

              {/* CRM Layout: Sidebar + Main Content */}
              <div className="grid lg:grid-cols-[12.5rem_1fr] min-h-[25rem]">
                {/* CRM Sidebar Navigation (Payload Pure Black) */}
                <aside className="hidden lg:block border-r border-neutral-800 bg-[#050505] p-3 space-y-3 text-xs">
                  <div>
                    <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Módulos CRM</p>
                    <div className="mt-1.5 space-y-1">
                      <div className="flex items-center gap-2 rounded bg-neutral-900 px-2.5 py-1.5 font-bold text-white border border-neutral-700">
                        <iconify-icon icon="solar:chart-2-bold" width="14" height="14" className="text-white"></iconify-icon>
                        <span>Dashboard General</span>
                      </div>
                      <div className="flex items-center gap-2 rounded px-2.5 py-1.5 text-neutral-400 hover:text-white hover:bg-neutral-900 transition">
                        <iconify-icon icon="solar:cart-large-2-linear" width="14" height="14"></iconify-icon>
                        <span>Pedidos & Ventas</span>
                        <span className="ml-auto rounded bg-neutral-800 px-1.5 py-0.2 text-[9px] font-bold text-white border border-neutral-700">3</span>
                      </div>
                      <div className="flex items-center gap-2 rounded px-2.5 py-1.5 text-neutral-400 hover:text-white hover:bg-neutral-900 transition">
                        <iconify-icon icon="solar:users-group-rounded-linear" width="14" height="14"></iconify-icon>
                        <span>Clientes & VIPs</span>
                      </div>
                      <div className="flex items-center gap-2 rounded px-2.5 py-1.5 text-neutral-400 hover:text-white hover:bg-neutral-900 transition">
                        <iconify-icon icon="solar:box-linear" width="14" height="14"></iconify-icon>
                        <span>Inventario & Stock</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Operaciones</p>
                    <div className="mt-1.5 space-y-1 text-neutral-400">
                      <div className="flex items-center gap-2 px-2.5 py-1.5 hover:text-white hover:bg-neutral-900 rounded transition">
                        <iconify-icon icon="solar:wallet-money-linear" width="14" height="14"></iconify-icon>
                        <span>Tasa Oficial & Pagos</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded border border-emerald-500/30 bg-emerald-950/20 p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Agente Conectado
                    </div>
                    <p className="mt-1 text-[10px] text-neutral-400 leading-tight">Cerrando ventas en WhatsApp e Instagram.</p>
                  </div>
                </aside>

                {/* Dashboard Main Grid Content */}
                <div className="bg-[#000000] p-3.5 sm:p-4 space-y-3">
                  {/* Compact KPI Row */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-2.5">
                      <span className="text-[10px] text-neutral-400 font-medium">💵 Ventas Hoy</span>
                      <p className="mt-1 text-lg font-extrabold text-white font-mono">$145.00</p>
                      <p className="text-[10px] text-emerald-400 font-mono">Bs. 10.150 (+18%)</p>
                    </div>
                    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-2.5">
                      <span className="text-[10px] text-neutral-400 font-medium">🛍️ Ventas Totales</span>
                      <p className="mt-1 text-lg font-extrabold text-white font-mono">$1.280.00</p>
                      <p className="text-[10px] text-neutral-300 font-mono">Bs. 89.600 (84 ped)</p>
                    </div>
                    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-2.5">
                      <span className="text-[10px] text-neutral-400 font-medium">👑 Clientes CRM</span>
                      <p className="mt-1 text-lg font-extrabold text-white">18 Clientes</p>
                      <p className="text-[10px] text-amber-400 font-bold">4 VIP Activos</p>
                    </div>
                    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-2.5">
                      <span className="text-[10px] text-neutral-400 font-medium">⏳ Por Despachar</span>
                      <p className="mt-1 text-lg font-extrabold text-amber-300">3 Pedidos</p>
                      <p className="text-[10px] text-neutral-400">2 Delivery · 1 Pickup</p>
                    </div>
                  </div>

                  {/* Compact Split */}
                  <div className="grid gap-2.5 lg:grid-cols-[1.1fr_0.9fr]">
                    {/* Left: 7 Days & Stock Alert */}
                    <div className="space-y-2.5">
                      {/* Stock Alert */}
                      <div className="flex items-center justify-between rounded border border-amber-500/30 bg-amber-950/20 px-3 py-1.5 text-xs">
                        <span className="flex items-center gap-1.5 text-amber-200 text-[10px] font-semibold">
                          <iconify-icon icon="solar:danger-triangle-bold" className="text-amber-400"></iconify-icon>
                          Stock Crítico:
                        </span>
                        <div className="flex gap-1.5">
                          <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] text-amber-300 font-bold border border-amber-500/30">Pizza Margarita (2 uds)</span>
                          <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] text-red-300 font-bold border border-red-500/30">Papas Rústicas (Agotado)</span>
                        </div>
                      </div>

                      {/* 7-Day Chart */}
                      <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-3">
                        <div className="flex items-center justify-between text-xs pb-1.5 border-b border-neutral-800">
                          <span className="font-bold text-neutral-300 text-[11px]">📊 Ventas de los Últimos 7 Días</span>
                          <span className="text-[10px] text-neutral-400 font-mono">$1.090 Total</span>
                        </div>
                        <div className="mt-2.5 grid grid-cols-7 gap-1.5 items-end h-16">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-full bg-neutral-800 rounded-t h-6"></div>
                            <span className="text-[8px] text-neutral-500 font-mono">Lun</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-full bg-neutral-700 rounded-t h-9"></div>
                            <span className="text-[8px] text-neutral-500 font-mono">Mar</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-full bg-neutral-800 rounded-t h-7"></div>
                            <span className="text-[8px] text-neutral-500 font-mono">Mie</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-full bg-neutral-600 rounded-t h-11"></div>
                            <span className="text-[8px] text-neutral-500 font-mono">Jue</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-full bg-neutral-500 rounded-t h-13"></div>
                            <span className="text-[8px] text-neutral-500 font-mono">Vie</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-full bg-emerald-500 rounded-t h-16"></div>
                            <span className="text-[8px] text-emerald-400 font-bold font-mono">Sab</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-full bg-white rounded-t h-11"></div>
                            <span className="text-[8px] text-white font-bold font-mono">Hoy</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: CRM & Orders Stream */}
                    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs pb-1.5 border-b border-neutral-800 font-bold text-neutral-300">
                        <span className="text-[11px]">👥 Clientes CRM & Pedidos</span>
                        <span className="text-[9px] text-emerald-400">En Vivo</span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between rounded bg-[#111111] p-2 border border-neutral-800">
                          <div>
                            <p className="font-bold text-white text-[10px]">Carlos Pérez <span className="text-[9px] text-amber-300 font-mono">👑 VIP</span></p>
                            <p className="text-[9px] text-neutral-400">#ORD-104 · Delivery Chacao</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-white text-[10px]">$24.50</p>
                            <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[8px] text-emerald-400 font-bold">🟢 Entregado</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between rounded bg-[#111111] p-2 border border-neutral-800">
                          <div>
                            <p className="font-bold text-white text-[10px]">Ana Morales <span className="text-[9px] text-neutral-300 font-mono">🔁 Recurrente</span></p>
                            <p className="text-[9px] text-neutral-400">#ORD-103 · Pickup</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-white text-[10px]">$18.00</p>
                            <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[8px] text-amber-400 font-bold">🟡 Pendiente</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Subtle bottom gradient transition */}
          <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-full bg-gradient-to-t from-[#0c0418] via-[#0c0418]/80 to-transparent"></div>
        </main>
      </div>

      {/* ========================================================================= */}
      {/* HIGH CONVICTION SCALING SECTION                                           */}
      {/* ========================================================================= */}
      <section className="relative bg-[#0c0418] py-24 text-white md:py-32">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-violet-300">
              Tecnología de Punta · Estándar USA
            </span>
            <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
              Estás haciendo las cosas bien.<br />
              <span className="text-[#7C3AED]">Con Flow tu negocio escala al siguiente nivel.</span>
            </h2>
            <p className="mt-6 text-base leading-relaxed text-slate-300 sm:text-lg">
              No necesitas cambiar tu forma de trabajar ni complicarte con herramientas difíciles. Flow es la solución definitiva: pensada, probada y estructurada con la mayor tecnología de Estados Unidos para que tu WhatsApp e Instagram vendan sin descanso.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {/* Card 1 */}
            <div className="card-glow rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-8 backdrop-blur-xl transition duration-300 hover:border-violet-400/60 hover:-translate-y-1">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-[#7C3AED] text-white shadow-lg shadow-violet-500/30">
                <iconify-icon icon="solar:moon-stars-bold-duotone" width="28" height="28"></iconify-icon>
              </div>
              <h3 className="mt-6 text-xl font-bold tracking-tight text-white">Ventas activas 24/7 mientras duermes</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Tus clientes pueden consultar, armar pedidos y pagar a las 11:00 p. m. o un domingo por la mañana. Flow responde en segundos con precisión quirúrgica.
              </p>
            </div>

            {/* Card 2 */}
            <div className="card-glow rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-8 backdrop-blur-xl transition duration-300 hover:border-emerald-400/60 hover:-translate-y-1">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
                <iconify-icon icon="solar:dollar-minimalistic-bold-duotone" width="28" height="28"></iconify-icon>
              </div>
              <h3 className="mt-6 text-xl font-bold tracking-tight text-white">0% Comisiones: Todo el margen es tuyo</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                No te quitamos porcentaje de tus ventas. Tienes la potencia de un Shopify integrado con agentes de IA de última generación por una tarifa plana insuperable.
              </p>
            </div>

            {/* Card 3 */}
            <div className="card-glow rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-8 backdrop-blur-xl transition duration-300 hover:border-indigo-400/60 hover:-translate-y-1">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30">
                <iconify-icon icon="solar:tuning-square-2-bold-duotone" width="28" height="28"></iconify-icon>
              </div>
              <h3 className="mt-6 text-xl font-bold tracking-tight text-white">Automatización completa de punta a punta</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Desde la primera pregunta, pasando por el catálogo interactivo, confirmación de stock, cálculo de tasas y reporte para despacho. Todo fluye solo.
              </p>
            </div>
          </div>

          {/* High Tech Banner */}
          <div className="mt-12 rounded-3xl border border-violet-500/30 bg-gradient-to-r from-violet-950/80 via-slate-900 to-violet-950/80 p-8 text-center md:p-10 shadow-2xl">
            <div className="mx-auto max-w-3xl">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <iconify-icon icon="solar:check-circle-bold" width="16" height="16"></iconify-icon>
                Ecosistema Blindado y Confiable
              </span>
              <h3 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl text-white">
                “Es como tener a tu mejor vendedor y a tu gerente de operaciones trabajando en equipo 24 horas al día.”
              </h3>
              <p className="mt-3 text-sm text-slate-300">
                Tus clientes reciben una experiencia VIP al instante y tu equipo se enfoca únicamente en empacar y crecer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* HOW IT WORKS                                                              */}
      {/* ========================================================================= */}
      <section id="como-funciona" className="relative overflow-hidden bg-[#0c0418] py-24 text-white md:py-32">
        <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-700/20 blur-3xl"></div>
        <div className="relative mx-auto max-w-7xl px-5 md:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-violet-400">Sencillo, rápido y probado</span>
            <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
              Cómo vende Flow por ti en 4 pasos.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-400 sm:text-lg">
              Sin cambiar tu número actual de WhatsApp ni obligar a tus clientes a descargar nada raro. Flow se adapta a tus productos y habla como tú.
            </p>
          </div>

          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Step 1 */}
            <div className="card-glow relative rounded-3xl border border-white/15 bg-white/[0.04] p-7 backdrop-blur-xl transition hover:border-violet-400/60">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-[#7C3AED] text-white font-bold shadow-lg">1</span>
                <iconify-icon icon="logos:whatsapp-icon" width="24" height="24"></iconify-icon>
              </div>
              <h3 className="mt-5 text-lg font-bold text-white">El cliente te escribe</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Por WhatsApp o Instagram a cualquier hora. Preguntando precios, modelos o combos.
              </p>
            </div>

            {/* Step 2 */}
            <div className="card-glow relative rounded-3xl border border-white/15 bg-white/[0.04] p-7 backdrop-blur-xl transition hover:border-violet-400/60">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-[#7C3AED] text-white font-bold shadow-lg">2</span>
                <iconify-icon icon="solar:magic-stick-3-bold-duotone" width="24" height="24" className="text-violet-300"></iconify-icon>
              </div>
              <h3 className="mt-5 text-lg font-bold text-white">Flow responde en segundos</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Con precio exacto, disponibilidad en tiempo real y el tono cercano y profesional de tu marca.
              </p>
            </div>

            {/* Step 3 */}
            <div className="card-glow relative rounded-3xl border border-white/15 bg-white/[0.04] p-7 backdrop-blur-xl transition hover:border-violet-400/60">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-[#7C3AED] text-white font-bold shadow-lg">3</span>
                <iconify-icon icon="solar:cart-check-bold-duotone" width="24" height="24" className="text-violet-300"></iconify-icon>
              </div>
              <h3 className="mt-5 text-lg font-bold text-white">Cierra la venta con e-commerce</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Redirecciona a tu catálogo web interactivo o toma los datos de entrega y pago directo en el chat.
              </p>
            </div>

            {/* Step 4 */}
            <div className="card-glow relative rounded-3xl border border-white/15 bg-white/[0.04] p-7 backdrop-blur-xl transition hover:border-violet-400/60">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-[#7C3AED] text-white font-bold shadow-lg">4</span>
                <iconify-icon icon="solar:box-minimalistic-bold-duotone" width="24" height="24" className="text-violet-300"></iconify-icon>
              </div>
              <h3 className="mt-5 text-lg font-bold text-white">Tu equipo solo despacha</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                El pedido entra organizado a tu panel con nota de entrega lista y cliente registrado en tu CRM.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ALL IN ONE ECOSYSTEM                                                      */}
      {/* ========================================================================= */}
      <section id="todo-en-uno" className="bg-[#f8f7fb] py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="grid items-end gap-8 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#7C3AED]">
                <iconify-icon icon="solar:layers-minimalistic-bold" width="16" height="16"></iconify-icon>
                Ecosistema Integral Centralizado
              </div>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-4xl md:text-5xl">
                No son 5 herramientas sueltas.<br />Es un solo sistema definitivo.
              </h2>
            </div>
            <p className="text-base leading-relaxed text-slate-600 sm:text-lg font-medium">
              Conectamos tus conversaciones de WhatsApp e Instagram con tu e-commerce, CRM, inventario y equipo en un solo ecosistema inteligente. Automatización total para que tu negocio destaque a un nivel sin igual.
            </p>
          </div>

          <div className="mt-16 grid gap-6 lg:grid-cols-2">
            {/* Card 1: Meta AI Agents */}
            <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 transition duration-300 hover:border-violet-400 hover:shadow-2xl hover:-translate-y-1 md:p-10">
              <div className="flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 p-3 text-[#7C3AED] shadow-sm">
                  <iconify-icon icon="solar:chat-square-like-bold-duotone" width="32" height="32"></iconify-icon>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-slate-100 border border-slate-200 px-3.5 py-1.5">
                  <iconify-icon icon="logos:whatsapp-icon" width="20" height="20"></iconify-icon>
                  <span className="text-slate-300">|</span>
                  <iconify-icon icon="skill-icons:instagram" width="20" height="20"></iconify-icon>
                  <span className="text-xs font-bold text-slate-800 ml-1">Meta Conectado</span>
                </div>
              </div>
              <h3 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-950">Agentes de IA en WhatsApp e Instagram</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 font-medium">
                Responden dudas complejas, envían fotos de productos, recomiendan opciones, recuperan carritos abandonados y concretan pagos las 24 horas sin sonar nunca como un robot genérico.
              </p>
              <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
                <div className="flex items-center justify-between text-xs font-bold text-violet-900">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    Atención Multicanal Inteligente
                  </span>
                  <span className="text-[#7C3AED]">Sin colas de espera</span>
                </div>
              </div>
            </article>

            {/* Card 2: International Grade E-commerce */}
            <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 transition duration-300 hover:border-violet-400 hover:shadow-2xl hover:-translate-y-1 md:p-10">
              <div className="flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 p-3 text-[#7C3AED] shadow-sm">
                  <iconify-icon icon="solar:shop-2-bold-duotone" width="32" height="32"></iconify-icon>
                </div>
                <span className="rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-extrabold text-emerald-800 border border-emerald-200">
                  0% Comisiones
                </span>
              </div>
              <h3 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-950">E-commerce de Grado Internacional</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 font-medium">
                Tus clientes ven fotos en alta resolución, precios en dólares o bolívares y compran en 2 clics desde su celular. El agente los redirecciona o ellos compran directamente con checkout instantáneo.
              </p>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <iconify-icon icon="solar:card-check-bold" width="18" height="18" className="text-violet-600"></iconify-icon>
                    Pagos: Pago Móvil, Zelle, Tarjeta, Efectivo
                  </span>
                  <span className="text-emerald-700 font-bold">Ultra Rápido</span>
                </div>
              </div>
            </article>

            {/* Card 3: CRM & Real-time Inventory */}
            <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 transition duration-300 hover:border-violet-400 hover:shadow-2xl hover:-translate-y-1 md:p-10">
              <div className="flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 p-3 text-[#7C3AED] shadow-sm">
                  <iconify-icon icon="solar:users-group-rounded-bold-duotone" width="32" height="32"></iconify-icon>
                </div>
                <span className="rounded-full bg-violet-100 px-3.5 py-1 text-xs font-extrabold text-[#7C3AED] border border-violet-200">
                  CRM Flow
                </span>
              </div>
              <h3 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-950">CRM, Pedidos e Inventario en Tiempo Real</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 font-medium">
                Cada cliente que escribe queda guardado automáticamente con su historial de compras, dirección y preferencias. Sabes exactamente qué tienes en stock, qué se vendió y a quién hacerle re-marketing.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-2.5 text-center text-xs">
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                  <p className="text-slate-500 font-bold text-[11px]">Pedidos Hoy</p>
                  <p className="text-xl font-extrabold text-slate-950">42</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                  <p className="text-slate-500 font-bold text-[11px]">Clientes CRM</p>
                  <p className="text-xl font-extrabold text-slate-950">1,240</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                  <p className="text-slate-500 font-bold text-[11px]">Stock Alerta</p>
                  <p className="text-xl font-extrabold text-emerald-600">Al día</p>
                </div>
              </div>
            </article>

            {/* Card 4: Team Operations Flow */}
            <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 transition duration-300 hover:border-violet-400 hover:shadow-2xl hover:-translate-y-1 md:p-10">
              <div className="flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 p-3 text-[#7C3AED] shadow-sm">
                  <iconify-icon icon="solar:clipboard-check-bold-duotone" width="32" height="32"></iconify-icon>
                </div>
                <span className="rounded-full bg-slate-100 px-3.5 py-1 text-xs font-extrabold text-slate-800 border border-slate-200">
                  Cero Enredos
                </span>
              </div>
              <h3 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-950">Flujo Colaborativo para tu Equipo</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 font-medium">
                Un tablero Kanban visual donde cada orden pasa por sus fases: nuevo pedido, pago verificado, preparación y despacho. Tu equipo sabe exactamente qué hacer sin que tú tengas que estar encima.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-2.5 text-xs font-bold">
                <div className="rounded-xl bg-violet-100/70 p-3 text-center text-violet-950 border border-violet-200">
                  ✓ Pagado
                </div>
                <div className="rounded-xl bg-amber-100/70 p-3 text-center text-amber-950 border border-amber-200">
                  ⚡ En Cocina
                </div>
                <div className="rounded-xl bg-emerald-100/70 p-3 text-center text-emerald-950 border border-emerald-200">
                  🚀 En Delivery
                </div>
              </div>
            </article>
          </div>

          {/* Digital Presence Callout */}
          <div className="card-glow-strong mt-8 rounded-3xl bg-slate-950 p-8 text-white md:p-10 border border-white/10">
            <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-violet-300">
                  <iconify-icon icon="solar:global-bold-duotone" width="26" height="26"></iconify-icon>
                </div>
                <h3 className="mt-5 text-2xl font-extrabold tracking-tight md:text-3xl">
                  También construimos tu presencia digital y tienda web a medida
                </h3>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base font-normal">
                  Creamos tu e-commerce y catálogo profesional exactamente como lo sueñes o como nos lo envíes. Todo conectado directamente con tus números de WhatsApp y cuentas de Instagram oficiales.
                </p>
              </div>
              <a href="#diagnostico" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-bold text-slate-950 shadow-xl transition duration-200 hover:bg-violet-100">
                Quiero mi catálogo así
                <iconify-icon icon="solar:arrow-right-linear" width="18" height="18" style={{ strokeWidth: 2 }}></iconify-icon>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* LIVE INTERACTIVE CATALOG DEMO                                             */}
      {/* ========================================================================= */}
      <section id="catalogo-demo" className="bg-white py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#7C3AED]">
              <iconify-icon icon="solar:smartphone-2-bold" width="16" height="16"></iconify-icon>
              Catálogo E-commerce en Vivo
            </span>
            <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl md:text-5xl">
              Así es el catálogo moderno que tendrán tus clientes.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg font-medium">
              Un e-commerce ultra veloz, visual y diseñado para vender. <strong>Puedes simular compras reales desde el catálogo aquí mismo</strong>, probar cómo se agregan los productos al carrito y experimentar todo el flujo de pedidos tal como lo vivirán tus clientes. Lo personalizamos con tu logo, colores, fotos y categorías a tu medida.
            </p>
          </div>

          {/* Live Embed Frame Container */}
          <div className="card-glow-strong relative mt-12 overflow-hidden rounded-3xl border border-slate-800 bg-[#0f0a1c] p-2.5 md:p-4 shadow-2xl">
            {/* Browser Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#160f27] px-4 py-3 text-white border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500"></span>
                <span className="h-3 w-3 rounded-full bg-amber-500"></span>
                <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
                <span className="ml-2 hidden text-xs font-bold text-slate-300 sm:inline">Tienda PWA Don Luigi · Prueba interactiva en vivo</span>
              </div>

              <div className="flex flex-1 max-w-md items-center justify-center">
                <div className="flex w-full items-center gap-2 rounded-xl bg-slate-900 px-4 py-1.5 text-xs text-slate-300 font-mono border border-white/10">
                  <iconify-icon icon="solar:lock-bold" className="text-emerald-400" width="14" height="14"></iconify-icon>
                  <span className="truncate">https://donluigi.martes.app</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/don-luigi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#7C3AED] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-violet-600 shadow-md"
                >
                  <span>Abrir en pantalla completa</span>
                  <iconify-icon icon="solar:arrow-right-up-linear" width="14" height="14"></iconify-icon>
                </a>
              </div>
            </div>

            {/* Embedded Interactive Iframe */}
            <div className="relative h-[52rem] w-full overflow-hidden rounded-b-2xl bg-slate-100">
              <iframe
                id="catalogFrame"
                src="/don-luigi"
                title="Catálogo E-commerce Demo Flow"
                className="h-full w-full border-0"
                loading="lazy"
                allow="payment; geolocation"
              ></iframe>
            </div>

            {/* Bottom Feature Callout under Embed */}
            <div className="mt-4 grid gap-4 p-2 sm:grid-cols-3 text-white">
              <div className="flex items-center gap-3.5 rounded-2xl bg-white/[0.06] p-4 border border-white/10">
                <iconify-icon icon="solar:cart-check-bold" width="24" height="24" className="text-emerald-400 shrink-0"></iconify-icon>
                <p className="text-xs text-slate-200"><strong>Simula tu pedido:</strong> Agrega hamburguesas o pizzas y mira lo fácil que es el checkout.</p>
              </div>
              <div className="flex items-center gap-3.5 rounded-2xl bg-white/[0.06] p-4 border border-white/10">
                <iconify-icon icon="solar:shield-check-bold" width="24" height="24" className="text-violet-400 shrink-0"></iconify-icon>
                <p className="text-xs text-slate-200"><strong>0% comisiones:</strong> Todo lo que cobras por tu catálogo va 100% directo a tus cuentas.</p>
              </div>
              <div className="flex items-center gap-3.5 rounded-2xl bg-white/[0.06] p-4 border border-white/10">
                <iconify-icon icon="solar:chat-round-dots-bold" width="24" height="24" className="text-indigo-400 shrink-0"></iconify-icon>
                <p className="text-xs text-slate-200"><strong>Conexión con la IA:</strong> El agente manda el link del carrito directo al chat del cliente.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* CONTROL SECTION: KNOWLEDGE BASE, 24/7 ATTENTION & END-TO-END FLOW        */}
      {/* ========================================================================= */}
      <section id="control" className="relative bg-[#070110] py-24 text-white md:py-32 overflow-hidden border-t border-b border-white/5">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          {/* Section Header */}
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-violet-300 mb-4">
              Atención Inteligente 24/7 · Gestión de Venta de Principio a Fin
            </span>
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Tú tienes el control absoluto.<br />
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
                Atención humana, conocimiento de tu empresa y ventas guiadas.
              </span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">
              Flow tiene todo el conocimiento de tu empresa (FAQs, envíos, métodos de pago y políticas) y responde las 24 horas en segundos. Recuerda a tus clientes por su nombre, los envía a la tienda con el link de compra y <strong>los espera en el chat para confirmar el pago y dejárselo listo a tu equipo de despacho</strong>.
            </p>
          </div>

          {/* Node Graph Canvas Container */}
          <div className="relative mt-14 rounded-3xl border border-white/15 bg-gradient-to-b from-[#110722] to-[#0a0316] p-6 sm:p-10 lg:p-12 shadow-2xl overflow-hidden">
            {/* Ambient Canvas Glow */}
            <div className="pointer-events-none absolute -left-20 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-emerald-600/15 blur-3xl"></div>
            <div className="pointer-events-none absolute -right-20 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-fuchsia-600/15 blur-3xl"></div>

            {/* Node Graph Wrapper */}
            <div className="relative grid gap-8 lg:grid-cols-[18rem_1fr_21rem] items-center z-10">
              {/* ================= LEFT COLUMN: Cliente & Knowledge ================= */}
              <div className="space-y-6 flex flex-col justify-center">
                {/* Left Node 1: Cliente Preguntando */}
                <div className="relative rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-950/40 via-[#130b24] to-slate-950 p-4 shadow-xl backdrop-blur-md transition hover:border-emerald-400">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20">
                        <iconify-icon icon="logos:whatsapp-icon" width="18" height="18"></iconify-icon>
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-white">Carlos Mendoza</p>
                        <p className="text-[10px] text-emerald-400 font-medium">Cliente en WhatsApp</p>
                      </div>
                    </div>
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                  </div>
                  
                  <div className="mt-3 rounded-xl bg-black/50 p-3 text-xs leading-relaxed text-slate-200 border border-emerald-500/20">
                    “¡Buenas tardes! ¿Tienen <strong>tornillos hexagonales de 1/2 pulgada</strong> y <strong>empacaduras</strong>? ¿Hacen envíos hoy en Caracas y qué pagos aceptan?”
                  </div>

                  {/* Connection Port Right */}
                  <div className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 h-6 w-6 items-center justify-center rounded-full bg-[#0c0418] border-2 border-emerald-400 shadow-[0_0_12px_#10b981]">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400"></div>
                  </div>
                </div>

                {/* Left Node 2: Knowledge Base & FAQs de la Empresa */}
                <div className="relative rounded-2xl border-2 border-violet-500/40 bg-gradient-to-b from-violet-950/40 via-[#130b24] to-slate-950 p-4 shadow-xl backdrop-blur-md transition hover:border-violet-400">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#7C3AED] text-white shadow-md shadow-violet-500/20">
                        <iconify-icon icon="solar:database-bold" width="18" height="18"></iconify-icon>
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-white">Knowledge & FAQs de tu Empresa</p>
                        <p className="text-[10px] text-violet-300 font-medium">Información Oficial</p>
                      </div>
                    </div>
                    <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[9px] font-bold text-violet-300 font-mono">BASE DE DATOS</span>
                  </div>
                  
                  {/* Clean Business Information Points */}
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center gap-2 rounded-lg bg-black/40 p-2 border border-white/5 text-[11px] text-slate-200">
                      <iconify-icon icon="solar:document-text-bold" className="text-amber-400 shrink-0" width="16" height="16"></iconify-icon>
                      <span><strong>FAQs & Envíos:</strong> Delivery activo hoy en Caracas + Pagos (Pago Móvil / Zelle)</span>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg bg-black/40 p-2 border border-white/5 text-[11px] text-slate-200">
                      <iconify-icon icon="solar:user-check-bold" className="text-emerald-400 shrink-0" width="16" height="16"></iconify-icon>
                      <span><strong>Memoria:</strong> Cliente Carlos (Taller Mecánico en Caracas · Cliente frecuente)</span>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg bg-black/40 p-2 border border-white/5 text-[11px] text-slate-200">
                      <iconify-icon icon="solar:clock-circle-bold" className="text-violet-400 shrink-0" width="16" height="16"></iconify-icon>
                      <span><strong>24/7 en Segundos:</strong> Respuestas inmediatas sin colas de espera</span>
                    </div>
                  </div>

                  {/* Connection Port Right */}
                  <div className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 h-6 w-6 items-center justify-center rounded-full bg-[#0c0418] border-2 border-violet-400 shadow-[0_0_12px_#a855f7]">
                    <div className="h-2.5 w-2.5 rounded-full bg-violet-400"></div>
                  </div>
                </div>
              </div>

              {/* ================= CENTER COLUMN: Asistente Flow Gestionando la Venta ================= */}
              <div className="relative rounded-3xl border-2 border-violet-400/50 bg-gradient-to-b from-[#1c0e35] via-[#120724] to-[#0e041c] p-6 shadow-2xl backdrop-blur-xl max-w-md mx-auto w-full">
                {/* Flow Badge Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-[#7C3AED] text-white shadow-lg shadow-violet-500/40">
                      <iconify-icon icon="solar:bolt-bold-duotone" width="22" height="22"></iconify-icon>
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-white">Asistente Inteligente Flow</h4>
                      <p className="text-[11px] text-violet-300 font-semibold">Atendiendo y gestionando la venta</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-300 border border-emerald-500/30 animate-pulse">
                    ● En Línea 24/7
                  </span>
                </div>

                {/* Left Input Ports (Hidden on mobile) */}
                <div className="hidden lg:flex absolute -left-3.5 top-1/3 -translate-y-1/2 h-6 w-6 items-center justify-center rounded-full bg-[#120a1f] border-2 border-emerald-400 shadow-[0_0_10px_#10b981]">
                  <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
                </div>
                <div className="hidden lg:flex absolute -left-3.5 top-2/3 -translate-y-1/2 h-6 w-6 items-center justify-center rounded-full bg-[#120a1f] border-2 border-purple-400 shadow-[0_0_10px_#a855f7]">
                  <div className="h-2 w-2 rounded-full bg-purple-400"></div>
                </div>

                {/* Steps of What Flow Does */}
                <div className="mt-4 space-y-3 text-xs">
                  <div className="rounded-xl bg-white/[0.04] p-3 border border-white/10 flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[11px]">1</span>
                    <div>
                      <p className="font-bold text-white text-[11px]">Responde con el Knowledge de tu negocio</p>
                      <p className="text-[10px] text-slate-300">Resuelve dudas de envíos, métodos de pago y condiciones con la información de tu empresa.</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.04] p-3 border border-white/10 flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300 font-bold text-[11px]">2</span>
                    <div>
                      <p className="font-bold text-white text-[11px]">Envía el enlace de compra</p>
                      <p className="text-[10px] text-slate-300">Guía al cliente al e-commerce para que elija los productos y arme su orden fácilmente.</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.04] p-3 border border-white/10 flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-fuchsia-500/20 text-fuchsia-300 font-bold text-[11px]">3</span>
                    <div>
                      <p className="font-bold text-white text-[11px]">Acompañamiento y confirmación</p>
                      <p className="text-[10px] text-slate-300">Espera en el chat para recibir el comprobante, confirmar el pago y dejárselo listo al vendedor.</p>
                    </div>
                  </div>
                </div>

                {/* Glowing Right Output Port */}
                <div className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 h-7 w-7 items-center justify-center rounded-full bg-[#120a1f] border-2 border-fuchsia-400 shadow-[0_0_16px_#e879f9]">
                  <div className="h-3 w-3 rounded-full bg-fuchsia-400 animate-ping"></div>
                </div>
              </div>

              {/* ================= RIGHT COLUMN: Respuesta en Chat & Redirección ================= */}
              <div className="space-y-4 flex flex-col justify-center">
                {/* Right Node: Respuesta con Link Directo y Espera en Chat */}
                <div className="relative rounded-2xl border-2 border-fuchsia-500/40 bg-gradient-to-b from-fuchsia-950/40 via-[#130b24] to-slate-950 p-5 shadow-2xl backdrop-blur-md transition hover:border-fuchsia-400">
                  {/* Port on Left */}
                  <div className="hidden lg:flex absolute -left-3.5 top-1/2 -translate-y-1/2 h-6 w-6 items-center justify-center rounded-full bg-[#0c0418] border-2 border-fuchsia-400 shadow-[0_0_12px_#e879f9]">
                    <div className="h-2.5 w-2.5 rounded-full bg-fuchsia-400"></div>
                  </div>

                  <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-fuchsia-600 to-purple-600 text-white shadow-md">
                        <iconify-icon icon="solar:chat-round-check-bold" width="16" height="16"></iconify-icon>
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-white">Respuesta en WhatsApp</p>
                        <p className="text-[9px] text-fuchsia-300 font-mono">Responde en 1.2 segundos</p>
                      </div>
                    </div>
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                      ✓ Link Enviado
                    </span>
                  </div>

                  {/* Conversational Message Bubble */}
                  <div className="mt-3 rounded-xl bg-black/60 p-3.5 text-xs leading-relaxed text-slate-100 border border-fuchsia-500/20 space-y-2.5">
                    <p>
                      “¡Buenas tardes, <strong>Carlos</strong>! Qué gusto saludarte de nuevo. Sí, tenemos disponibles los <strong>tornillos hexagonales de 1/2&quot;</strong> y las <strong>empacaduras</strong> en nuestra tienda online. Sí realizamos envíos hoy mismo en Caracas y aceptamos Pago Móvil, Zelle y transferencias.”
                    </p>
                    <div className="rounded-lg bg-violet-600/25 p-2.5 border border-violet-500/40 text-violet-200">
                      👉 <a href="/don-luigi" target="_blank" rel="noopener noreferrer" className="font-bold underline text-white hover:text-violet-300">Toca aquí para ver los modelos en la tienda y hacer tu pedido en 2 clics</a>
                    </div>
                    <p className="text-[11px] text-slate-300 bg-white/[0.04] p-2 rounded-lg border border-white/5">
                      “<strong>Aquí me quedo esperándote en el chat para cuando termines la compra</strong>, recibir tu comprobante, confirmarte el pago y pasarte tu número de guía de una vez.”
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-white/5">
                    <span className="text-emerald-400 font-bold">🟢 Venta guiada al e-commerce</span>
                    <span className="text-fuchsia-300 font-bold">💬 Acompañamiento en chat</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SVG Connection Wires for Large Screens */}
            <svg className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block z-0" xmlns="http://www.w3.org/2000/svg">
              {/* Wire 1: Cliente -> Flow */}
              <path d="M 290 125 C 370 125, 360 210, 440 210" fill="none" stroke="#10b981" strokeWidth="2.5" className="animate-flow-wire" strokeOpacity="0.85" />
              {/* Wire 2: Negocio Knowledge -> Flow */}
              <path d="M 290 320 C 370 320, 360 290, 440 290" fill="none" stroke="#a855f7" strokeWidth="2.5" className="animate-flow-wire" strokeOpacity="0.85" />
              {/* Wire 3: Flow -> Respuesta Directa */}
              <path d="M 780 260 C 860 260, 850 240, 930 240" fill="none" stroke="#e879f9" strokeWidth="2.5" className="animate-flow-wire" strokeOpacity="0.95" />
            </svg>

            {/* Bottom 3 Visual Highlight Cards */}
            <div className="mt-12 pt-8 border-t border-white/10 grid gap-5 sm:grid-cols-3 text-left">
              {/* Card 1: Memoria & Trato Humano */}
              <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/30 to-black/40 p-5 shadow-lg">
                <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm mb-2">
                  <iconify-icon icon="solar:user-check-bold" width="22" height="22"></iconify-icon>
                  <span>Conoce a tu Cliente</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  Sabe el nombre de tu cliente, su contexto y sus preferencias. Si vuelve a escribir semanas después, retoma la conversación con total familiaridad sin sentirse como un interrogatorio.
                </p>
              </div>

              {/* Card 2: Knowledge Base & FAQs */}
              <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-b from-violet-950/30 to-black/40 p-5 shadow-lg">
                <div className="flex items-center gap-2.5 text-violet-300 font-bold text-sm mb-2">
                  <iconify-icon icon="solar:database-bold" width="22" height="22"></iconify-icon>
                  <span>Knowledge Base & FAQs 24/7</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  Tiene toda la información clave de tu negocio: zonas de delivery, formas de pago, garantías y políticas para responder preguntas importantes en segundos las 24 horas del día.
                </p>
              </div>

              {/* Card 3: Gestión de Principio a Fin */}
              <div className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-b from-fuchsia-950/30 to-black/40 p-5 shadow-lg">
                <div className="flex items-center gap-2.5 text-fuchsia-400 font-bold text-sm mb-2">
                  <iconify-icon icon="solar:bag-check-bold" width="22" height="22"></iconify-icon>
                  <span>Gestión de Venta de Principio a Fin</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  Envía el link al catálogo para armar la orden, espera al cliente en el chat para recibir el comprobante y confirmar el pago, dejándolo todo organizado para tu equipo de despacho.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* PRICING PLANS                                                             */}
      {/* ========================================================================= */}
      <section id="precio" className="bg-[#f8f7fb] py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#7C3AED]">Planes Claros · 0% Comisiones</span>
            <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl md:text-5xl">
              La solución definitiva que se paga sola.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg font-medium">
              Literalmente tienes la potencia de un Shopify + Agentes de IA en WhatsApp e Instagram por una fracción de lo que cuesta un solo empleado. Y sin quitarnos ni un solo centavo de tus ventas.
            </p>
          </div>

          {/* 3 Alive Animated Steps */}
          <div className="mt-16 grid gap-6 md:grid-cols-3 relative">
            {/* Step 1 */}
            <div className="animate-step-1 rounded-3xl border-2 border-violet-200 bg-white p-8 transition duration-300 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-[#7C3AED] uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-[#7C3AED] animate-pulse"></span>
                  Paso 01
                </span>
                <iconify-icon icon="solar:chat-round-dots-bold-duotone" width="28" height="28" className="text-violet-600"></iconify-icon>
              </div>
              <h3 className="mt-5 text-xl font-extrabold text-slate-950">Diagnóstico Inmediato con IA</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600 font-medium">
                Hablas directamente con nuestro agente en WhatsApp o Instagram y evaluamos tus necesidades de catálogo y ventas al instante.
              </p>
            </div>

            {/* Step 2 */}
            <div className="animate-step-2 rounded-3xl border-2 border-violet-200 bg-white p-8 transition duration-300 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-[#7C3AED] uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-[#7C3AED] animate-pulse"></span>
                  Paso 02
                </span>
                <iconify-icon icon="solar:tuning-square-2-bold-duotone" width="28" height="28" className="text-violet-600"></iconify-icon>
              </div>
              <h3 className="mt-5 text-xl font-extrabold text-slate-950">Montaje Técnico Acompañado</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600 font-medium">
                Conectamos tus canales oficiales, te asistimos en la estructura de productos y dejamos tu catálogo listo en 48 horas.
              </p>
            </div>

            {/* Step 3 */}
            <div className="animate-step-3 rounded-3xl border-2 border-violet-200 bg-white p-8 transition duration-300 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Paso 03
                </span>
                <iconify-icon icon="solar:rocket-bold-duotone" width="28" height="28" className="text-emerald-600"></iconify-icon>
              </div>
              <h3 className="mt-5 text-xl font-extrabold text-slate-950">Ventas en Piloto Automático</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600 font-medium">
                Flow atiende y cierra pedidos 24/7 mientras tú recibes las órdenes organizadas y listas para despachar.
              </p>
            </div>
          </div>

          {/* Pricing Plans Comparison Cards */}
          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            {/* Plan 1: $50 / mes */}
            <div className="relative flex flex-col justify-between rounded-3xl border-2 border-slate-200 bg-white p-8 shadow-xl transition duration-300 hover:border-violet-300 md:p-10">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-violet-100 px-3.5 py-1 text-xs font-extrabold text-[#7C3AED]">Plan Pro Starter</span>
                  <span className="text-xs font-bold text-emerald-600 uppercase">0% Comisiones</span>
                </div>
                
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold tracking-tight text-slate-950">$50</span>
                  <span className="text-slate-500 font-bold">/ mes</span>
                </div>
                
                <p className="mt-4 text-sm leading-relaxed text-slate-600 font-medium">
                  Ideal para negocios que quieren empezar a automatizar su canal principal de ventas con IA y catálogo online.
                </p>

                <div className="mt-8 space-y-3.5 border-t border-slate-100 pt-6 text-sm text-slate-700 font-medium">
                  <div className="flex items-center gap-3">
                    <iconify-icon icon="solar:check-circle-bold" width="20" height="20" className="text-emerald-500 shrink-0"></iconify-icon>
                    <span><strong>5.000 respuestas con IA al mes</strong></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <iconify-icon icon="solar:check-circle-bold" width="20" height="20" className="text-emerald-500 shrink-0"></iconify-icon>
                    <span><strong>1 Canal Oficial:</strong> WhatsApp <u>o</u> Instagram</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <iconify-icon icon="solar:check-circle-bold" width="20" height="20" className="text-emerald-500 shrink-0"></iconify-icon>
                    <span>Catálogo E-commerce base listo para vender</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <iconify-icon icon="solar:check-circle-bold" width="20" height="20" className="text-emerald-500 shrink-0"></iconify-icon>
                    <span>Agente de IA entrenado con tus productos y precios</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <iconify-icon icon="solar:check-circle-bold" width="20" height="20" className="text-emerald-500 shrink-0"></iconify-icon>
                    <span>CRM básico de pedidos y clientes</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <iconify-icon icon="solar:check-circle-bold" width="20" height="20" className="text-emerald-500 shrink-0"></iconify-icon>
                    <span>Acompañamiento y montaje técnico</span>
                  </div>
                </div>
              </div>

              <a href="#diagnostico" className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-950 bg-slate-950 py-4 text-sm font-bold text-white transition hover:bg-[#7C3AED] hover:border-[#7C3AED]">
                Comenzar con Plan $50
                <iconify-icon icon="solar:arrow-right-linear" width="18" height="18"></iconify-icon>
              </a>
            </div>

            {/* Plan 2: $70 / mes (Featured) */}
            <div className="card-glow-strong relative flex flex-col justify-between rounded-3xl bg-gradient-to-br from-[#7C3AED] to-[#4C1D95] p-8 text-white shadow-2xl md:p-10 ring-4 ring-violet-400/50">
              <div className="absolute -top-3.5 right-8 rounded-full bg-emerald-400 px-4 py-1 text-xs font-extrabold text-slate-950 shadow-md uppercase tracking-wider">
                Recomendado · Más Vendido
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-white/20 px-3.5 py-1 text-xs font-bold text-white backdrop-blur">Plan Ultimate 360°</span>
                  <span className="text-xs font-bold text-emerald-300 uppercase">0% Comisiones</span>
                </div>
                
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold tracking-tight text-white">$70</span>
                  <span className="text-violet-200 font-bold">/ mes</span>
                </div>
                
                <p className="mt-4 text-sm leading-relaxed text-violet-100 font-medium">
                  La solución completa y definitiva para dominar todos tus canales de venta y automatizar tu negocio de punta a punta.
                </p>

                <div className="mt-8 space-y-3.5 border-t border-white/15 pt-6 text-sm text-violet-100 font-medium">
                  <div className="flex items-center gap-3">
                    <iconify-icon icon="solar:check-circle-bold" width="20" height="20" className="text-emerald-300 shrink-0"></iconify-icon>
                    <span><strong>10.000 respuestas con IA al mes</strong></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <iconify-icon icon="solar:check-circle-bold" width="20" height="20" className="text-emerald-300 shrink-0"></iconify-icon>
                    <span><strong>Multicanal Simultáneo:</strong> WhatsApp <u>e</u> Instagram</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <iconify-icon icon="solar:check-circle-bold" width="20" height="20" className="text-emerald-300 shrink-0"></iconify-icon>
                    <span><strong>Catálogo E-commerce 100% Personalizado a tu medida</strong></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <iconify-icon icon="solar:check-circle-bold" width="20" height="20" className="text-emerald-300 shrink-0"></iconify-icon>
                    <span>Agentes de IA con memoria y segmentación de clientes</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <iconify-icon icon="solar:check-circle-bold" width="20" height="20" className="text-emerald-300 shrink-0"></iconify-icon>
                    <span>CRM Avanzado + Control de inventario en tiempo real</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <iconify-icon icon="solar:check-circle-bold" width="20" height="20" className="text-emerald-300 shrink-0"></iconify-icon>
                    <span>Automatizaciones de seguimiento y recuperación de ventas</span>
                  </div>
                </div>
              </div>

              <a href="#diagnostico" className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white py-4 text-sm font-extrabold text-[#7C3AED] shadow-xl transition hover:bg-violet-50">
                Quiero la Solución Completa $70
                <iconify-icon icon="solar:arrow-right-linear" width="18" height="18"></iconify-icon>
              </a>
            </div>
          </div>

          {/* Modern Zero Commission Guarantee Card */}
          <div className="mt-10 overflow-hidden rounded-3xl border border-emerald-500/30 bg-[#0f1915] p-6 sm:p-8 text-white shadow-xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  <iconify-icon icon="solar:shield-check-bold" width="30" height="30"></iconify-icon>
                </div>
                <div>
                  <h4 className="text-lg font-extrabold text-emerald-300">Garantía Inquebrantable de Cero Comisiones</h4>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                    A diferencia de otras plataformas que te cobran un porcentaje de cada venta, en Flow pagas únicamente tu suscripción fija y el 100% de lo que facturas es tuyo.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-black text-slate-950 uppercase tracking-wider shrink-0 shadow-lg shadow-emerald-500/20">
                100% Tu Margen
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* DIRECT & INTERACTIVE AI DIAGNOSTIC VIA WHATSAPP & INSTAGRAM               */}
      {/* ========================================================================= */}
      <section id="diagnostico" className="relative overflow-hidden bg-[#0c0418] py-24 text-white md:py-32">
        <div className="pointer-events-none absolute -left-32 top-16 h-96 w-96 rounded-full bg-violet-700/20 blur-3xl"></div>
        <div className="pointer-events-none absolute -right-32 bottom-16 h-96 w-96 rounded-full bg-fuchsia-700/20 blur-3xl"></div>
        
        <div className="relative mx-auto max-w-7xl px-5 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-violet-300">
              Diagnóstico Directo con IA
            </span>
            <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Haz tu diagnóstico al instante con nuestro Agente de IA.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">
              Sin formularios lentos ni esperas. Chatea directamente con nuestro agente inteligente en WhatsApp o Instagram, cuéntale sobre tu negocio y recibe una propuesta y auditoría personalizada en 5 minutos.
            </p>
          </div>

          {/* Direct Interactive Channel Cards */}
          <div className="mt-14 grid gap-6 sm:grid-cols-2 max-w-4xl mx-auto">
            {/* Card 1: WhatsApp Directo */}
            <a 
              href="https://wa.me/584149189169?text=Hola%2C%20quiero%20hacer%20el%20diagn%C3%B3stico%20gratis%20con%20Flow%20para%20mi%20empresa" 
              target="_blank" 
              rel="noopener noreferrer"
              className="card-glow group relative flex flex-col justify-between rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/40 to-slate-950 p-8 transition duration-300 hover:border-emerald-400 hover:-translate-y-1 hover:shadow-emerald-500/20"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <iconify-icon icon="logos:whatsapp-icon" width="32" height="32"></iconify-icon>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                    Agente Activo 24/7
                  </span>
                </div>

                <h3 className="mt-6 text-2xl font-extrabold text-white">Chatear por WhatsApp</h3>
                <p className="mt-1 text-sm font-mono text-emerald-400">+58 0414 918 9169</p>
                
                <p className="mt-4 text-sm leading-relaxed text-slate-300">
                  Inicia la conversación directo con nuestro agente. Te hará unas preguntas breves y te mostrará cómo Flow automatizará tus pedidos.
                </p>
              </div>

              <div className="mt-8 flex items-center justify-center gap-2 rounded-full bg-emerald-500 py-3.5 text-sm font-extrabold text-slate-950 transition duration-200 group-hover:bg-emerald-400 shadow-lg">
                <span>Iniciar Diagnóstico en WhatsApp</span>
                <iconify-icon icon="solar:arrow-right-linear" width="18" height="18" style={{ strokeWidth: 2 }}></iconify-icon>
              </div>
            </a>

            {/* Card 2: Instagram Directo */}
            <a 
              href="https://ig.me/m/martes.app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="card-glow group relative flex flex-col justify-between rounded-3xl border border-fuchsia-500/30 bg-gradient-to-b from-fuchsia-950/40 to-slate-950 p-8 transition duration-300 hover:border-fuchsia-400 hover:-translate-y-1 hover:shadow-fuchsia-500/20"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30">
                    <iconify-icon icon="skill-icons:instagram" width="32" height="32"></iconify-icon>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full bg-fuchsia-500/10 px-3 py-1 text-xs font-bold text-fuchsia-400 border border-fuchsia-500/30">
                    <span className="h-2 w-2 rounded-full bg-fuchsia-400 animate-ping"></span>
                    DM Abierto 24/7
                  </span>
                </div>

                <h3 className="mt-6 text-2xl font-extrabold text-white">Chatear por Instagram</h3>
                <p className="mt-1 text-sm font-mono text-fuchsia-400">@martes.app</p>
                
                <p className="mt-4 text-sm leading-relaxed text-slate-300">
                  Escríbenos por mensaje directo (DM) en Instagram y prueba en tiempo real cómo responde nuestro agente con catálogo y catálogo visual.
                </p>
              </div>

              <div className="mt-8 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3.5 text-sm font-extrabold text-white transition duration-200 group-hover:from-fuchsia-500 group-hover:to-violet-500 shadow-lg">
                <span>Abrir DM en Instagram @martes.app</span>
                <iconify-icon icon="solar:arrow-right-linear" width="18" height="18" style={{ strokeWidth: 2 }}></iconify-icon>
              </div>
            </a>
          </div>

          {/* Trust Note */}
          <p className="mt-10 text-center text-xs font-medium text-slate-400">
            💡 Respuesta garantizada en segundos · Sin compromiso comercial · 100% enfocado en tu negocio
          </p>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* FAQ                                                                       */}
      {/* ========================================================================= */}
      <section className="bg-white py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-5 md:px-8">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[#7C3AED]">Preguntas Frecuentes</span>
            <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl md:text-5xl">
              Todo lo que necesitas saber.
            </h2>
            <p className="mt-4 text-sm text-slate-600 font-medium">Transparencia total antes de empezar.</p>
          </div>

          <div className="mt-14 divide-y divide-slate-200 border-y border-slate-200">
            {/* Question 1 */}
            <details className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-base font-bold text-slate-950">
                ¿Tengo que cambiar mi número de WhatsApp actual?
                <iconify-icon icon="solar:add-circle-linear" width="22" height="22" className="shrink-0 text-[#7C3AED] transition group-open:rotate-45" style={{ strokeWidth: 2 }}></iconify-icon>
              </summary>
              <p className="mt-3 max-w-3xl pr-10 text-sm leading-relaxed text-slate-600 font-medium">
                No, para nada. Integramos Flow directamente con tu número actual de WhatsApp Business o personal mediante la API Oficial. Tus clientes te siguen escribiendo al mismo número de siempre.
              </p>
            </details>

            {/* Question 2 */}
            <details className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-base font-bold text-slate-950">
                ¿Flow se queda con alguna comisión de mis ventas?
                <iconify-icon icon="solar:add-circle-linear" width="22" height="22" className="shrink-0 text-[#7C3AED] transition group-open:rotate-45" style={{ strokeWidth: 2 }}></iconify-icon>
              </summary>
              <p className="mt-3 max-w-3xl pr-10 text-sm leading-relaxed text-slate-600 font-medium">
                ¡Absolutamente no! Cobramos únicamente tu tarifa plana mensual ($50 o $70). Cero porcentaje por transacción, cero costos ocultos. Todo lo que vendes es 100% tuyo.
              </p>
            </details>

            {/* Question 3 */}
            <details className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-base font-bold text-slate-950">
                ¿Cómo es el montaje del catálogo y la carga de productos?
                <iconify-icon icon="solar:add-circle-linear" width="22" height="22" className="shrink-0 text-[#7C3AED] transition group-open:rotate-45" style={{ strokeWidth: 2 }}></iconify-icon>
              </summary>
              <p className="mt-3 max-w-3xl pr-10 text-sm leading-relaxed text-slate-600 font-medium">
                Nosotros nos encargamos de todo el montaje técnico de la plataforma y te asistimos en la carga inicial de productos. Tú nos proporcionas las fotos, nombres y precios de tus artículos, y nosotros te brindamos el acompañamiento para que tu catálogo quede limpio, estructurado y con imágenes profesionales.
              </p>
            </details>

            {/* Question 4 */}
            <details className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-base font-bold text-slate-950">
                ¿La IA puede inventar precios o equivocarse con mi stock?
                <iconify-icon icon="solar:add-circle-linear" width="22" height="22" className="shrink-0 text-[#7C3AED] transition group-open:rotate-45" style={{ strokeWidth: 2 }}></iconify-icon>
              </summary>
              <p className="mt-3 max-w-3xl pr-10 text-sm leading-relaxed text-slate-600 font-medium">
                No. Flow está blindado para responder estrictamente con tu catálogo oficial, tus fotos reales, tus precios y tus reglas de inventario sincronizadas en CRM. Además, tú puedes exigir confirmación para cualquier pedido sensible.
              </p>
            </details>

            {/* Question 5 */}
            <details className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-base font-bold text-slate-950">
                ¿Mis clientes van a sentir que hablan con un robot aburrido?
                <iconify-icon icon="solar:add-circle-linear" width="22" height="22" className="shrink-0 text-[#7C3AED] transition group-open:rotate-45" style={{ strokeWidth: 2 }}></iconify-icon>
              </summary>
              <p className="mt-3 max-w-3xl pr-10 text-sm leading-relaxed text-slate-600 font-medium">
                Jamás. Entrenamos al agente con la calidez, modismos y tono propio de tu marca. Si en algún momento la conversación requiere atención humana, la IA te notifica y te pasa el chat al instante.
              </p>
            </details>

            {/* Question 6 */}
            <details className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-base font-bold text-slate-950">
                ¿Puedo entrar a responder personalmente cuando yo quiera?
                <iconify-icon icon="solar:add-circle-linear" width="22" height="22" className="shrink-0 text-[#7C3AED] transition group-open:rotate-45" style={{ strokeWidth: 2 }}></iconify-icon>
              </summary>
              <p className="mt-3 max-w-3xl pr-10 text-sm leading-relaxed text-slate-600 font-medium">
                Sí, 100%. Tanto tú como tu equipo pueden tomar cualquier chat en un clic. En ese momento Flow se pone en modo pausa y vuelve a activarse cuando tú lo decidas.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* FINAL CTA                                                                 */}
      {/* ========================================================================= */}
      <section className="bg-white px-5 pb-24 md:px-8 md:pb-32">
        <div className="card-glow-strong relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#7C3AED] via-violet-700 to-[#4C1D95] px-6 py-16 text-center text-white shadow-2xl md:px-12 md:py-20">
          <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-white/15 blur-3xl"></div>
          
          <div className="relative mx-auto max-w-3xl">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider backdrop-blur">
              Automatiza tu negocio hoy mismo
            </span>
            <h2 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Multiplica tus ventas sin multiplicar tus horas de trabajo.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-violet-100 sm:text-lg font-medium">
              Flow atiende, vende y organiza tu negocio 24/7 con IA de vanguardia para que tú te dediques a hacer crecer tu marca.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href="https://wa.me/584149189169?text=Hola%2C%20quiero%20hacer%20el%20diagn%C3%B3stico%20gratis%20con%20Flow%20para%20mi%20empresa" target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-extrabold text-[#7C3AED] shadow-xl transition hover:-translate-y-0.5 hover:bg-violet-50 sm:w-auto">
                Diagnóstico Gratis en WhatsApp
                <iconify-icon icon="solar:arrow-right-linear" width="18" height="18" style={{ strokeWidth: 2 }}></iconify-icon>
              </a>
            </div>
            <p className="mt-4 text-xs font-semibold text-violet-200">5 minutos · Sin tarjeta · 0% Comisiones</p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* FOOTER                                                                    */}
      {/* ========================================================================= */}
      <footer className="bg-[#07020f] text-white">
        <div className="mx-auto max-w-7xl px-5 py-14 md:px-8">
          <div className="flex flex-col gap-8 border-b border-white/10 pb-12 md:flex-row md:items-center md:justify-between">
            {/* Logo */}
            <a href="#inicio" className="flex items-center gap-2.5" aria-label="Flow, volver al inicio">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED] text-white shadow-lg">
                <iconify-icon icon="solar:bolt-bold-duotone" width="22" height="22"></iconify-icon>
              </span>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight">Flow</span>
                <span className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">by Martes</span>
              </div>
            </a>

            {/* Footer Nav */}
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-400 font-semibold">
              <a href="#como-funciona" className="transition hover:text-white">Cómo funciona</a>
              <a href="#todo-en-uno" className="transition hover:text-white">Qué incluye</a>
              <a href="#catalogo-demo" className="transition hover:text-white">Catálogo Demo</a>
              <a href="#control" className="transition hover:text-white">Tu control</a>
              <a href="#precio" className="transition hover:text-white">Precios</a>
              <a href="#diagnostico" className="transition hover:text-white">Contacto</a>
            </div>
          </div>

          {/* Copyright Sub-row */}
          <div className="flex flex-col gap-4 pt-8 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between font-medium">
            <p>© {currentYear} Flow by Martes. Todos los derechos reservados.</p>
            <p className="flex items-center gap-2">
              <span>Ventas más simples. Negocios que escalan sin límites.</span>
            </p>
          </div>

          {/* Large Modern Branding: MARTES APP */}
          <div className="mt-14 pt-8 border-t border-white/5 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.35em] text-violet-400/80 mb-2">Desarrollado con orgullo por</span>
            <h2 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter uppercase bg-gradient-to-b from-white/25 via-white/10 to-transparent bg-clip-text text-transparent select-none font-display">
              MARTES APP
            </h2>
          </div>
        </div>
      </footer>
    </div>
  );
}

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
  const [workflowExpanded, setWorkflowExpanded] = useState(false);
  const [faqExpanded, setFaqExpanded] = useState(false);
  const [currentYear, setCurrentYear] = useState('2026');

  useEffect(() => {
    setCurrentYear(new Date().getFullYear().toString());
  }, []);

  return (
    <div className="overflow-x-hidden bg-[#0c0418] text-slate-950 antialiased selection:bg-violet-500 selection:text-white font-sans">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION (FOCO PRINCIPAL #1)                                       */}
      {/* ========================================================================= */}
      <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-white via-[#f0eaff] to-[#7C3AED]">
        {/* Ambient Glows */}
        <div className="pointer-events-none absolute left-1/2 top-10 h-72 w-72 sm:h-96 sm:w-96 -translate-x-1/2 rounded-full bg-white/90 blur-3xl"></div>
        <div className="pointer-events-none absolute -left-20 top-1/3 h-64 w-64 sm:h-96 sm:w-96 rounded-full bg-fuchsia-300/30 blur-3xl"></div>

        {/* Navigation */}
        <nav className="relative z-50 mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 md:px-8">
          <Link href="#inicio" className="flex items-center gap-2" aria-label="Flow by Martes, inicio">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7C3AED] text-white shadow-md shadow-violet-500/30 ring-2 ring-white/70">
              <iconify-icon icon="solar:bolt-bold-duotone" width="22" height="22"></iconify-icon>
            </span>
            <div className="flex flex-col text-left">
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-950 leading-tight">Flow</span>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-violet-700">by Martes</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-6 lg:gap-8 text-xs lg:text-sm font-semibold text-slate-700 md:flex">
            <a href="#video" className="transition hover:text-[#7C3AED] flex items-center gap-1">
              <iconify-icon icon="solar:play-circle-bold" className="text-violet-600"></iconify-icon>
              Ver Video
            </a>
            <a href="#catalogo-demo" className="transition hover:text-[#7C3AED]">Demo Don Luigi</a>
            <a href="#control" className="transition hover:text-[#7C3AED]">Cómo funciona</a>
            <a href="#precio" className="transition hover:text-[#7C3AED]">Precios</a>
            <a href="#diagnostico" className="transition hover:text-[#7C3AED]">Diagnóstico</a>
          </div>

          {/* Header CTA + Acceso Admin */}
          <div className="hidden items-center gap-2.5 md:flex">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/15 bg-white/90 px-4 py-2 text-xs font-extrabold text-slate-900 shadow-sm backdrop-blur transition hover:bg-slate-950 hover:text-white hover:border-slate-950"
            >
              <iconify-icon icon="solar:shield-user-bold" width="15" height="15" className="text-[#7C3AED]"></iconify-icon>
              <span>Acceso Admin</span>
            </Link>

            <a
              href="#diagnostico"
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-lg transition duration-200 hover:bg-[#7C3AED]"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Diagnóstico con IA
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            id="menuButton"
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-900/10 bg-white/80 text-slate-900 shadow-sm backdrop-blur md:hidden"
            aria-label="Abrir menú"
          >
            <iconify-icon icon={mobileMenuOpen ? "solar:close-circle-bold" : "solar:hamburger-menu-linear"} width="20" height="20"></iconify-icon>
          </button>
        </nav>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="relative z-50 mx-4 rounded-2xl border border-white/60 bg-white/95 p-4 shadow-2xl backdrop-blur-lg md:hidden">
            <div className="flex flex-col gap-1 text-sm font-semibold text-slate-800">
              <a href="#video" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 hover:bg-violet-50 flex items-center gap-2">
                <iconify-icon icon="solar:play-circle-bold" className="text-[#7C3AED]"></iconify-icon>
                Ver Video Demostrativo
              </a>
              <a href="#catalogo-demo" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 hover:bg-violet-50">Demo Don Luigi</a>
              <a href="#control" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 hover:bg-violet-50">Cómo funciona & Control</a>
              <a href="#precio" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 hover:bg-violet-50">Precios</a>
              <a href="#diagnostico" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 hover:bg-violet-50">Diagnóstico & FAQs</a>
              
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-violet-100 px-4 py-3 text-center font-bold text-[#7C3AED] hover:bg-violet-200 transition"
              >
                <iconify-icon icon="solar:shield-user-bold" width="16" height="16"></iconify-icon>
                <span>Acceso Admin</span>
              </Link>

              <a
                href="#diagnostico"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-center font-bold text-white shadow-lg"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                Diagnóstico con IA al instante
              </a>
            </div>
          </div>
        )}

        {/* Hero Content */}
        <main id="inicio" className="relative z-20 mx-auto flex max-w-7xl flex-col items-center px-4 pb-20 pt-8 text-center sm:px-6 md:pb-28 md:pt-14">
          
          {/* Short & Crisp Badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300 bg-white/85 px-3.5 py-1.5 text-[11px] sm:text-xs font-bold text-violet-900 shadow-sm backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            ⚡ Ventas 24/7 en Piloto Automático · 0% Comisiones
          </div>

          {/* Main Headline */}
          <h1 className="max-w-5xl text-3xl font-extrabold leading-[1.12] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Tu negocio vendiendo 24/7 en piloto automático.<br />
            <span className="bg-gradient-to-r from-[#7C3AED] via-violet-600 to-indigo-600 bg-clip-text text-transparent">
              Atención y ventas sin descanso.
            </span>
          </h1>

          {/* Short, Direct Subtitle */}
          <p className="mt-4 sm:mt-5 max-w-2xl text-sm sm:text-base md:text-lg leading-relaxed text-slate-700 font-normal">
            Flow atiende tu WhatsApp e Instagram en segundos, responde las dudas de tu empresa con IA, guía a tus clientes a tu catálogo e-commerce y cobra con <strong>0% comisiones</strong>.
          </p>

          {/* Action Buttons (Thumb Friendly on Mobile) */}
          <div className="mt-7 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <a
              href="#diagnostico"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3.5 text-xs sm:text-sm font-bold text-white shadow-xl transition duration-200 hover:bg-[#7C3AED] sm:w-auto"
            >
              Diagnóstico con IA al instante
              <iconify-icon icon="solar:arrow-right-linear" width="16" height="16" className="transition group-hover:translate-x-1"></iconify-icon>
            </a>
            <a
              href="#catalogo-demo"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-900/15 bg-white/90 px-5 py-3.5 text-xs sm:text-sm font-bold text-slate-800 shadow-sm backdrop-blur transition hover:bg-white sm:w-auto"
            >
              <iconify-icon icon="solar:shop-2-bold" width="16" height="16" className="text-violet-600"></iconify-icon>
              Probar Demo Don Luigi en vivo
            </a>
          </div>

          {/* Trust Chips */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] sm:text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1">
              <iconify-icon icon="solar:shield-check-bold" width="14" height="14" className="text-emerald-600"></iconify-icon>
              0% comisión
            </span>
            <span className="flex items-center gap-1">
              <iconify-icon icon="solar:bolt-circle-bold" width="14" height="14" className="text-violet-600"></iconify-icon>
              Responde en 1s
            </span>
            <span className="flex items-center gap-1">
              <iconify-icon icon="solar:card-2-bold" width="14" height="14" className="text-indigo-600"></iconify-icon>
              Sin tarjeta
            </span>
          </div>

          {/* ========================================================================= */}
          {/* FLOATING CONVERSATION CARDS (Desktop/Tablet Ambient)                      */}
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
          {/* COMPACT CRM DASHBOARD (Payload CMS Pure Black Style - Mobile Optimized)   */}
          {/* ========================================================================= */}
          <div className="mt-10 sm:mt-12 w-full max-w-5xl rounded-2xl border border-neutral-800 bg-black/90 p-2 shadow-2xl shadow-black/90 backdrop-blur-2xl relative z-20 text-white">
            <div className="overflow-hidden rounded-xl border border-neutral-800 bg-[#000000] text-left">
              
              {/* Top Bar (Payload Style) */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 bg-[#0a0a0a] px-3.5 py-2 sm:px-5">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-white text-black font-black text-[10px]">FL</span>
                  <span className="font-extrabold text-white text-[11px] sm:text-xs">Flow</span>
                  <span className="text-neutral-600">/</span>
                  <span className="font-bold text-emerald-400 text-[11px] sm:text-xs truncate max-w-[120px] sm:max-w-none">Don Luigi & Burgers</span>
                </div>

                {/* Quick Action Bar (Connected to Real Link) */}
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <a href="/demo" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded bg-white px-2.5 py-1 text-black hover:bg-neutral-200 transition text-[10px] sm:text-[11px] font-bold">
                    <iconify-icon icon="solar:shop-2-bold" width="12" height="12"></iconify-icon>
                    <span>Ver Tienda</span>
                  </a>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded bg-neutral-900 px-2 py-1 text-neutral-300 border border-neutral-800 text-[10px]">
                    <iconify-icon icon="solar:add-circle-bold" width="12" height="12" className="text-emerald-400"></iconify-icon>
                    + Producto
                  </span>
                </div>
              </div>

              {/* CRM Layout: Sidebar + Main Content */}
              <div className="grid lg:grid-cols-[12rem_1fr]">
                {/* CRM Sidebar Navigation */}
                <aside className="hidden lg:block border-r border-neutral-800 bg-[#050505] p-3 space-y-3 text-xs">
                  <div>
                    <p className="px-2 text-[9px] font-bold uppercase tracking-wider text-neutral-500">Módulos CRM</p>
                    <div className="mt-1.5 space-y-1">
                      <div className="flex items-center gap-2 rounded bg-neutral-900 px-2.5 py-1.5 font-bold text-white border border-neutral-700">
                        <iconify-icon icon="solar:chart-2-bold" width="13" height="13"></iconify-icon>
                        <span>Dashboard</span>
                      </div>
                      <div className="flex items-center gap-2 rounded px-2.5 py-1.5 text-neutral-400 hover:text-white transition">
                        <iconify-icon icon="solar:cart-large-2-linear" width="13" height="13"></iconify-icon>
                        <span>Pedidos & Ventas</span>
                        <span className="ml-auto rounded bg-neutral-800 px-1 py-0.2 text-[8px] font-bold text-white">3</span>
                      </div>
                      <div className="flex items-center gap-2 rounded px-2.5 py-1.5 text-neutral-400 hover:text-white transition">
                        <iconify-icon icon="solar:users-group-rounded-linear" width="13" height="13"></iconify-icon>
                        <span>Clientes & VIPs</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded border border-emerald-500/30 bg-emerald-950/20 p-2 text-[10px]">
                    <div className="flex items-center gap-1 font-bold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Agente Activo 24/7
                    </div>
                    <p className="mt-0.5 text-neutral-400">Cerrando ventas sin colas.</p>
                  </div>
                </aside>

                {/* Dashboard Main Grid Content */}
                <div className="bg-[#000000] p-3 sm:p-4 space-y-2.5 sm:space-y-3">
                  {/* Compact KPI 2x2 Grid on Mobile */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-2 sm:p-2.5">
                      <span className="text-[9px] sm:text-[10px] text-neutral-400 font-medium">💵 Ventas Hoy</span>
                      <p className="mt-0.5 text-base sm:text-lg font-extrabold text-white font-mono">$145.00</p>
                      <p className="text-[9px] text-emerald-400 font-mono">Bs. 10.150 (+18%)</p>
                    </div>
                    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-2 sm:p-2.5">
                      <span className="text-[9px] sm:text-[10px] text-neutral-400 font-medium">🛍️ Total Mes</span>
                      <p className="mt-0.5 text-base sm:text-lg font-extrabold text-white font-mono">$1.280.00</p>
                      <p className="text-[9px] text-neutral-300 font-mono">84 pedidos</p>
                    </div>
                    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-2 sm:p-2.5">
                      <span className="text-[9px] sm:text-[10px] text-neutral-400 font-medium">👑 Clientes CRM</span>
                      <p className="mt-0.5 text-base sm:text-lg font-extrabold text-white">18 Clientes</p>
                      <p className="text-[9px] text-amber-400 font-bold">4 VIPs</p>
                    </div>
                    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-2 sm:p-2.5">
                      <span className="text-[9px] sm:text-[10px] text-neutral-400 font-medium">⏳ Despachos</span>
                      <p className="mt-0.5 text-base sm:text-lg font-extrabold text-amber-300">3 Órdenes</p>
                      <p className="text-[9px] text-neutral-400">Listos para enviar</p>
                    </div>
                  </div>

                  {/* Compact Split: Left (Chart 7 Days) | Right (Mini CRM + Orders) */}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {/* Left: 7-Day Chart */}
                    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-2.5 sm:p-3">
                      <div className="flex items-center justify-between text-xs pb-1 border-b border-neutral-800">
                        <span className="font-bold text-neutral-300 text-[10px] sm:text-[11px]">📊 Ventas Últimos 7 Días</span>
                        <span className="text-[9px] text-neutral-400 font-mono">$1.090 Total</span>
                      </div>
                      <div className="mt-2 grid grid-cols-7 gap-1 items-end h-14 sm:h-16">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-full bg-neutral-800 rounded-t h-5"></div>
                          <span className="text-[7px] sm:text-[8px] text-neutral-500 font-mono">Lun</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-full bg-neutral-700 rounded-t h-8"></div>
                          <span className="text-[7px] sm:text-[8px] text-neutral-500 font-mono">Mar</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-full bg-neutral-800 rounded-t h-6"></div>
                          <span className="text-[7px] sm:text-[8px] text-neutral-500 font-mono">Mie</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-full bg-neutral-600 rounded-t h-9"></div>
                          <span className="text-[7px] sm:text-[8px] text-neutral-500 font-mono">Jue</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-full bg-neutral-500 rounded-t h-11"></div>
                          <span className="text-[7px] sm:text-[8px] text-neutral-500 font-mono">Vie</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-full bg-emerald-500 rounded-t h-14"></div>
                          <span className="text-[7px] sm:text-[8px] text-emerald-400 font-bold font-mono">Sab</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-full bg-white rounded-t h-10"></div>
                          <span className="text-[7px] sm:text-[8px] text-white font-bold font-mono">Hoy</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: CRM & Orders Stream */}
                    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-2.5 sm:p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs pb-1 border-b border-neutral-800 font-bold text-neutral-300">
                        <span className="text-[10px] sm:text-[11px]">👥 Pedidos en Tiempo Real</span>
                        <span className="text-[8px] text-emerald-400 font-mono">🟢 En Vivo</span>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between rounded bg-[#111111] p-1.5 sm:p-2 border border-neutral-800">
                          <div>
                            <p className="font-bold text-white text-[10px]">Carlos Pérez <span className="text-[8px] text-amber-300 font-mono">👑 VIP</span></p>
                            <p className="text-[8px] sm:text-[9px] text-neutral-400">#ORD-104 · Chacao</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-white text-[10px]">$24.50</p>
                            <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[7px] sm:text-[8px] text-emerald-400 font-bold">Entregado</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between rounded bg-[#111111] p-1.5 sm:p-2 border border-neutral-800">
                          <div>
                            <p className="font-bold text-white text-[10px]">Ana Morales <span className="text-[8px] text-neutral-300 font-mono">🔁 Recurrente</span></p>
                            <p className="text-[8px] sm:text-[9px] text-neutral-400">#ORD-103 · Pickup</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-white text-[10px]">$18.00</p>
                            <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[7px] sm:text-[8px] text-amber-400 font-bold">Pendiente</span>
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
          <div className="pointer-events-none absolute bottom-0 left-0 h-28 sm:h-40 w-full bg-gradient-to-t from-[#0c0418] via-[#0c0418]/80 to-transparent"></div>
        </main>
      </div>

      {/* ========================================================================= */}
      {/* 2. VIDEO SHOWCASE (FOCO PRINCIPAL #2: CONTENEDOR DEDICADO DE VIDEO)       */}
      {/* ========================================================================= */}
      <section id="video" className="relative bg-[#0c0418] py-16 sm:py-24 text-white border-b border-white/5">
        <div className="pointer-events-none absolute left-1/2 top-10 h-80 w-80 -translate-x-1/2 rounded-full bg-violet-700/20 blur-3xl"></div>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 md:px-8 relative z-10">
          
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/15 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-violet-300">
              <iconify-icon icon="solar:play-circle-bold" width="16" height="16" className="text-emerald-400"></iconify-icon>
              Video Demostrativo
            </span>
            <h2 className="mt-3.5 text-2xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
              Mira cómo vende Flow en 60 segundos.
            </h2>
            <p className="mt-3 text-xs sm:text-base leading-relaxed text-slate-300 font-medium">
              Descubre cómo un cliente escribe por WhatsApp, la IA responde con los datos de tu empresa, envía el enlace de compra y organiza el pedido al instante.
            </p>
          </div>

          <div className="mt-8 sm:mt-10 rounded-3xl border-2 border-violet-500/30 bg-gradient-to-b from-[#180d2d] to-[#0a0316] p-2.5 sm:p-4 shadow-2xl shadow-violet-950/60 backdrop-blur-xl">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-950 border border-white/10 flex items-center justify-center group cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-tr from-black via-slate-950 to-violet-950/80"></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-violet-600/20 via-transparent to-transparent"></div>

              <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center">
                <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-gradient-to-tr from-[#7C3AED] to-emerald-400 text-slate-950 shadow-2xl shadow-violet-500/50 transition duration-300 group-hover:scale-110">
                  <iconify-icon icon="solar:play-bold" width="32" height="32" className="ml-1 text-white"></iconify-icon>
                </div>
                
                <h3 className="mt-4 text-base sm:text-xl font-extrabold text-white">
                  Haz clic para reproducir el recorrido en video
                </h3>
                <p className="mt-1 text-xs text-slate-400 font-mono">
                  Duración: 1:15 min · Demostración en tiempo real
                </p>
              </div>

              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-slate-400 font-mono z-10 hidden sm:flex">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Flow Video Tour HD
                </span>
                <span>0:00 / 1:15</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. LIVE INTERACTIVE DEMO DON LUIGI (FOCO PRINCIPAL #3: CONECTADO REAL)     */}
      {/* ========================================================================= */}
      <section id="catalogo-demo" className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-[#7C3AED]">
              <iconify-icon icon="solar:smartphone-2-bold" width="15" height="15"></iconify-icon>
              Demo en Vivo · Conectado en Tiempo Real
            </span>
            <h2 className="mt-3.5 text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-950">
              Prueba el catálogo de Don Luigi aquí mismo.
            </h2>
            <p className="mt-3 text-xs sm:text-base leading-relaxed text-slate-600 font-medium">
              <strong>Puedes simular un pedido real directamente en la tienda aquí abajo</strong>. Diseñado para celulares, con carga instantánea y checkout en 2 clics. Lo adaptamos con tu logo, fotos, precios y categorías.
            </p>
          </div>

          <div className="card-glow-strong relative mt-8 sm:mt-10 overflow-hidden rounded-3xl border border-slate-800 bg-[#0f0a1c] p-2 sm:p-3 shadow-2xl">
            {/* Browser Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#160f27] px-3.5 py-2.5 text-white border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                <span className="ml-1 text-[11px] font-bold text-slate-300 truncate">Tienda PWA Don Luigi</span>
              </div>

              <div className="flex items-center gap-2">
                <a href="/demo" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded bg-[#7C3AED] px-3 py-1 text-[11px] font-bold text-white transition hover:bg-violet-600 shadow-sm">
                  <span>Abrir pantalla completa</span>
                  <iconify-icon icon="solar:arrow-right-up-linear" width="12" height="12"></iconify-icon>
                </a>
              </div>
            </div>

            {/* Embedded Interactive Iframe */}
            <div className="relative h-[36rem] sm:h-[46rem] md:h-[52rem] w-full overflow-hidden rounded-b-xl bg-slate-100">
              <iframe 
                id="catalogFrame"
                src="/demo" 
                title="Catálogo E-commerce Demo Don Luigi" 
                className="h-full w-full border-0"
                loading="lazy"
                allow="payment; geolocation"
              ></iframe>
            </div>

            {/* Bottom Feature Callout */}
            <div className="mt-3 grid gap-2 p-1 sm:grid-cols-3 text-white text-xs">
              <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] p-3 border border-white/10">
                <iconify-icon icon="solar:cart-check-bold" width="20" height="20" className="text-emerald-400 shrink-0"></iconify-icon>
                <p className="text-slate-200"><strong>Prueba el carrito:</strong> Agrega hamburguesas o pizzas y mira lo fácil que es el checkout.</p>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] p-3 border border-white/10">
                <iconify-icon icon="solar:shield-check-bold" width="20" height="20" className="text-violet-400 shrink-0"></iconify-icon>
                <p className="text-slate-200"><strong>0% comisiones:</strong> Pagos directos a tu Pago Móvil, Zelle o cuenta bancaria.</p>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] p-3 border border-white/10">
                <iconify-icon icon="solar:chat-round-dots-bold" width="20" height="20" className="text-indigo-400 shrink-0"></iconify-icon>
                <p className="text-slate-200"><strong>Conectado a la IA:</strong> El agente manda el link directo al chat del cliente.</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. CÓMO FUNCIONA & CONTROL (TARJETAS + BOTÓN DE DESPLIEGUE EDGE-TO-EDGE)    */}
      {/* ========================================================================= */}
      <section id="control" className="relative bg-[#070110] py-16 sm:py-24 text-white overflow-hidden border-t border-b border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/15 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-violet-300 mb-3">
              Atención Inteligente 24/7 · Gestión de Principio a Fin
            </span>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
              Tú tienes el control absoluto.<br />
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
                Atención humana, conocimiento de tu empresa y ventas guiadas.
              </span>
            </h2>
            <p className="mt-3 text-xs sm:text-base leading-relaxed text-slate-300 font-medium">
              Flow tiene todo el conocimiento de tu negocio (FAQs, envíos, métodos de pago y políticas) y responde las 24 horas en segundos. Recuerda a tus clientes por su nombre, los envía a la tienda con el link de compra y <strong>los espera en el chat para confirmar el pago</strong>.
            </p>
          </div>

          {/* 3 Core Highlight Cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3 text-left">
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/30 to-black/40 p-4 shadow-lg">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm mb-1.5">
                <iconify-icon icon="solar:user-check-bold" width="18" height="18"></iconify-icon>
                <span>Conoce a tu Cliente</span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed font-medium">
                Sabe el nombre de tu cliente y sus compras previas. Retoma la charla con total familiaridad sin sentirse como un interrogatorio.
              </p>
            </div>

            <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-b from-violet-950/30 to-black/40 p-4 shadow-lg">
              <div className="flex items-center gap-2 text-violet-300 font-bold text-xs sm:text-sm mb-1.5">
                <iconify-icon icon="solar:database-bold" width="18" height="18"></iconify-icon>
                <span>Knowledge Base & FAQs 24/7</span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed font-medium">
                Tiene la información clave: zonas de delivery, formas de pago, garantías y políticas para responder dudas en segundos.
              </p>
            </div>

            <div className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-b from-fuchsia-950/30 to-black/40 p-4 shadow-lg">
              <div className="flex items-center gap-2 text-fuchsia-400 font-bold text-xs sm:text-sm mb-1.5">
                <iconify-icon icon="solar:bag-check-bold" width="18" height="18"></iconify-icon>
                <span>Gestión de Principio a Fin</span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed font-medium">
                Envía el link al catálogo, espera al cliente en el chat para recibir el comprobante y deja la orden lista para tu despacho.
              </p>
            </div>
          </div>

          {/* Edge-to-Edge Expansion Trigger Bar */}
          <div className="mt-6">
            <button 
              type="button" 
              onClick={() => setWorkflowExpanded(!workflowExpanded)}
              className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-950/60 via-slate-900 to-violet-950/60 hover:border-violet-400/60 transition duration-300 shadow-xl text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600/25 text-violet-300 border border-violet-500/30 group-hover:bg-[#7C3AED] group-hover:text-white transition">
                  <iconify-icon icon="solar:diagram-up-bold" width="20" height="20"></iconify-icon>
                </span>
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-white">
                    {workflowExpanded ? 'Ocultar caso detallado' : 'Ver caso real paso a paso (Ferretería & Repuestos)'}
                  </p>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium">Diagrama visual de cómo Flow atiende a Carlos Mendoza con tornillos 1/2"</p>
                </div>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-violet-300 group-hover:bg-white group-hover:text-slate-950 transition">
                <iconify-icon icon="solar:alt-arrow-down-linear" width="18" height="18" className={`transition duration-300 ${workflowExpanded ? 'rotate-180' : ''}`}></iconify-icon>
              </div>
            </button>
          </div>

          {/* Node Graph Canvas Container */}
          {workflowExpanded && (
            <div className="relative mt-6 rounded-3xl border border-white/15 bg-gradient-to-b from-[#110722] to-[#0a0316] p-4 sm:p-8 lg:p-10 shadow-2xl overflow-hidden transition-all duration-500">
              <div className="pointer-events-none absolute -left-20 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-emerald-600/15 blur-3xl"></div>
              <div className="pointer-events-none absolute -right-20 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-fuchsia-600/15 blur-3xl"></div>

              <div className="relative grid gap-6 lg:grid-cols-[17rem_1fr_20rem] items-center z-10">
                {/* Left Column */}
                <div className="space-y-4 sm:space-y-5 flex flex-col justify-center">
                  <div className="relative rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-950/40 via-[#130b24] to-slate-950 p-4 shadow-xl backdrop-blur-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 font-bold shadow-md">
                          <iconify-icon icon="logos:whatsapp-icon" width="16" height="16"></iconify-icon>
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-white">Carlos Mendoza</p>
                          <p className="text-[10px] text-emerald-400 font-medium">Cliente en WhatsApp</p>
                        </div>
                      </div>
                      <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                    </div>
                    
                    <div className="mt-2.5 rounded-xl bg-black/50 p-2.5 text-xs leading-relaxed text-slate-200 border border-emerald-500/20">
                      “¡Buenas tardes! ¿Tienen <strong>tornillos hexagonales de 1/2 pulgada</strong> y <strong>empacaduras</strong>? ¿Hacen envíos hoy en Caracas y qué pagos aceptan?”
                    </div>
                  </div>

                  <div className="relative rounded-2xl border-2 border-violet-500/40 bg-gradient-to-b from-violet-950/40 via-[#130b24] to-slate-950 p-4 shadow-xl backdrop-blur-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#7C3AED] text-white shadow-md">
                          <iconify-icon icon="solar:database-bold" width="16" height="16"></iconify-icon>
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-white">Knowledge & FAQs de tu Empresa</p>
                          <p className="text-[10px] text-violet-300 font-medium">Información Oficial</p>
                        </div>
                      </div>
                      <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[8px] font-bold text-violet-300 font-mono">BASE DE DATOS</span>
                    </div>
                    
                    <div className="mt-2.5 space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 rounded-lg bg-black/40 p-2 border border-white/5 text-[11px] text-slate-200">
                        <iconify-icon icon="solar:document-text-bold" className="text-amber-400 shrink-0" width="15" height="15"></iconify-icon>
                        <span><strong>FAQs & Envíos:</strong> Delivery activo hoy en Caracas + Pagos (Pago Móvil / Zelle)</span>
                      </div>

                      <div className="flex items-center gap-2 rounded-lg bg-black/40 p-2 border border-white/5 text-[11px] text-slate-200">
                        <iconify-icon icon="solar:user-check-bold" className="text-emerald-400 shrink-0" width="15" height="15"></iconify-icon>
                        <span><strong>Memoria:</strong> Carlos Mendoza (Taller Mecánico · Cliente frecuente)</span>
                      </div>

                      <div className="flex items-center gap-2 rounded-lg bg-black/40 p-2 border border-white/5 text-[11px] text-slate-200">
                        <iconify-icon icon="solar:clock-circle-bold" className="text-violet-400 shrink-0" width="15" height="15"></iconify-icon>
                        <span><strong>24/7 en Segundos:</strong> Respuestas inmediatas sin esperas</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Center Column */}
                <div className="relative rounded-3xl border-2 border-violet-400/50 bg-gradient-to-b from-[#1c0e35] via-[#120724] to-[#0e041c] p-5 sm:p-6 shadow-2xl backdrop-blur-xl max-w-md mx-auto w-full">
                  <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-[#7C3AED] text-white shadow-md">
                        <iconify-icon icon="solar:bolt-bold-duotone" width="20" height="20"></iconify-icon>
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-extrabold text-white">Asistente Inteligente Flow</h4>
                        <p className="text-[10px] text-violet-300 font-semibold">Atendiendo y gestionando la venta</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-500/30">
                      ● En Línea 24/7
                    </span>
                  </div>

                  <div className="mt-3.5 space-y-2.5 text-xs">
                    <div className="rounded-xl bg-white/[0.04] p-2.5 border border-white/10 flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">1</span>
                      <div>
                        <p className="font-bold text-white text-[11px]">Responde con el Knowledge de tu negocio</p>
                        <p className="text-[10px] text-slate-300">Aclara envíos, pagos y condiciones con la información de tu empresa.</p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white/[0.04] p-2.5 border border-white/10 flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300 font-bold text-[10px]">2</span>
                      <div>
                        <p className="font-bold text-white text-[11px]">Envía el enlace de compra</p>
                        <p className="text-[10px] text-slate-300">Guía al cliente al e-commerce para que elija los productos y arme su orden.</p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white/[0.04] p-2.5 border border-white/10 flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-fuchsia-500/20 text-fuchsia-300 font-bold text-[10px]">3</span>
                      <div>
                        <p className="font-bold text-white text-[11px]">Acompañamiento y confirmación</p>
                        <p className="text-[10px] text-slate-300">Espera en el chat para recibir el comprobante y confirmar el pago.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4 flex flex-col justify-center">
                  <div className="relative rounded-2xl border-2 border-fuchsia-500/40 bg-gradient-to-b from-fuchsia-950/40 via-[#130b24] to-slate-950 p-4 sm:p-5 shadow-2xl backdrop-blur-md">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-fuchsia-600 to-purple-600 text-white shadow-md">
                          <iconify-icon icon="solar:chat-round-check-bold" width="14" height="14"></iconify-icon>
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-white">Respuesta en WhatsApp</p>
                          <p className="text-[9px] text-fuchsia-300 font-mono">Responde en 1.2 segundos</p>
                        </div>
                      </div>
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400">
                        ✓ Link Enviado
                      </span>
                    </div>

                    <div className="mt-2.5 rounded-xl bg-black/60 p-3 text-xs leading-relaxed text-slate-100 border border-fuchsia-500/20 space-y-2">
                      <p>
                        “¡Buenas tardes, <strong>Carlos</strong>! Qué gusto saludarte de nuevo. Sí, tenemos disponibles los <strong>tornillos hexagonales de 1/2"</strong> y las <strong>empacaduras</strong> en nuestra tienda online. Sí realizamos envíos hoy en Caracas y aceptamos Pago Móvil, Zelle y transferencias.”
                      </p>
                      <div className="rounded-lg bg-violet-600/25 p-2 border border-violet-500/40 text-violet-200">
                        👉 <a href="/demo" target="_blank" rel="noopener noreferrer" className="font-bold underline text-white hover:text-violet-300">Toca aquí para ver los modelos de tienda en acción</a>
                      </div>
                      <p className="text-[11px] text-slate-300 bg-white/[0.04] p-2 rounded-lg border border-white/5">
                        “<strong>Aquí me quedo esperándote en el chat para cuando termines la compra</strong>, recibir tu comprobante, confirmarte el pago y pasarte tu número de guía de una vez.”
                      </p>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-white/5">
                      <span className="text-emerald-400 font-bold">🟢 Venta guiada al e-commerce</span>
                      <span className="text-fuchsia-300 font-bold">💬 Chat abierto</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. PRICING PLANS (PASOS ANIMADOS + TARIFAS PLANAS $50 / $70)              */}
      {/* ========================================================================= */}
      <section id="precio" className="bg-[#f8f7fb] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#7C3AED]">Planes Claros · 0% Comisiones</span>
            <h2 className="mt-3.5 text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-950">
              La solución definitiva que se paga sola.
            </h2>
            <p className="mt-3 text-xs sm:text-base leading-relaxed text-slate-600 font-medium">
              Potencia de e-commerce + Agentes de IA en WhatsApp e Instagram por una fracción de lo que cuesta un empleado, y con <strong>0% comisiones sobre tus ventas</strong>.
            </p>
          </div>

          {/* 3 Alive Animated Steps */}
          <div className="mt-10 sm:mt-12 grid gap-4 md:grid-cols-3 relative">
            <div className="animate-step-1 rounded-3xl border-2 border-violet-200 bg-white p-6 sm:p-7 transition duration-300 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-[#7C3AED] uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#7C3AED] animate-pulse"></span>
                  Paso 01
                </span>
                <iconify-icon icon="solar:chat-round-dots-bold-duotone" width="24" height="24" className="text-violet-600"></iconify-icon>
              </div>
              <h3 className="mt-4 text-lg font-extrabold text-slate-950">Diagnóstico Inmediato con IA</h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600 font-medium">
                Hablas directamente con nuestro agente en WhatsApp o Instagram y evaluamos tus necesidades de catálogo al instante.
              </p>
            </div>

            <div className="animate-step-2 rounded-3xl border-2 border-violet-200 bg-white p-6 sm:p-7 transition duration-300 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-[#7C3AED] uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#7C3AED] animate-pulse"></span>
                  Paso 02
                </span>
                <iconify-icon icon="solar:tuning-square-2-bold-duotone" width="24" height="24" className="text-violet-600"></iconify-icon>
              </div>
              <h3 className="mt-4 text-lg font-extrabold text-slate-950">Montaje Técnico Acompañado</h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600 font-medium">
                Conectamos tus canales oficiales, te asistimos en la estructura de productos y dejamos tu catálogo listo en 48 horas.
              </p>
            </div>

            <div className="animate-step-3 rounded-3xl border-2 border-violet-200 bg-white p-6 sm:p-7 transition duration-300 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Paso 03
                </span>
                <iconify-icon icon="solar:rocket-bold-duotone" width="24" height="24" className="text-emerald-600"></iconify-icon>
              </div>
              <h3 className="mt-4 text-lg font-extrabold text-slate-950">Ventas en Piloto Automático</h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600 font-medium">
                Flow atiende y cierra pedidos 24/7 mientras tú recibes las órdenes organizadas y listas para despachar.
              </p>
            </div>
          </div>

          {/* Pricing Plans Comparison Cards */}
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {/* Plan 1: $50 / mes */}
            <div className="relative flex flex-col justify-between rounded-3xl border-2 border-slate-200 bg-white p-6 sm:p-8 shadow-xl transition duration-300 hover:border-violet-300">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-extrabold text-[#7C3AED]">Plan Pro Starter</span>
                  <span className="text-xs font-bold text-emerald-600 uppercase">0% Comisiones</span>
                </div>
                
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-950">$50</span>
                  <span className="text-slate-500 font-bold">/ mes</span>
                </div>
                
                <p className="mt-3 text-xs sm:text-sm leading-relaxed text-slate-600 font-medium">
                  Ideal para negocios que quieren automatizar su canal principal de ventas con IA y catálogo online.
                </p>

                <div className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-xs sm:text-sm text-slate-700 font-medium">
                  <div className="flex items-center gap-2.5">
                    <iconify-icon icon="solar:check-circle-bold" width="18" height="18" className="text-emerald-500 shrink-0"></iconify-icon>
                    <span><strong>5.000 respuestas con IA al mes</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <iconify-icon icon="solar:check-circle-bold" width="18" height="18" className="text-emerald-500 shrink-0"></iconify-icon>
                    <span><strong>1 Canal Oficial:</strong> WhatsApp <u>o</u> Instagram</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <iconify-icon icon="solar:check-circle-bold" width="18" height="18" className="text-emerald-500 shrink-0"></iconify-icon>
                    <span>Catálogo E-commerce base listo para vender</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <iconify-icon icon="solar:check-circle-bold" width="18" height="18" className="text-emerald-500 shrink-0"></iconify-icon>
                    <span>Agente entrenado con el Knowledge de tu negocio</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <iconify-icon icon="solar:check-circle-bold" width="18" height="18" className="text-emerald-500 shrink-0"></iconify-icon>
                    <span>CRM básico de pedidos y clientes</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <iconify-icon icon="solar:check-circle-bold" width="18" height="18" className="text-emerald-500 shrink-0"></iconify-icon>
                    <span>Acompañamiento y montaje técnico en 48h</span>
                  </div>
                </div>
              </div>

              <a href="#diagnostico" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-950 bg-slate-950 py-3.5 text-xs sm:text-sm font-bold text-white transition hover:bg-[#7C3AED] hover:border-[#7C3AED]">
                Comenzar con Plan $50
                <iconify-icon icon="solar:arrow-right-linear" width="16" height="16"></iconify-icon>
              </a>
            </div>

            {/* Plan 2: $70 / mes (Featured) */}
            <div className="card-glow-strong relative flex flex-col justify-between rounded-3xl bg-gradient-to-br from-[#7C3AED] to-[#4C1D95] p-6 sm:p-8 text-white shadow-2xl ring-4 ring-violet-400/50">
              <div className="absolute -top-3 right-6 rounded-full bg-emerald-400 px-3.5 py-1 text-[11px] font-extrabold text-slate-950 shadow-md uppercase tracking-wider">
                Recomendado · Más Vendido
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur">Plan Ultimate 360°</span>
                  <span className="text-xs font-bold text-emerald-300 uppercase">0% Comisiones</span>
                </div>
                
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">$70</span>
                  <span className="text-violet-200 font-bold">/ mes</span>
                </div>
                
                <p className="mt-3 text-xs sm:text-sm leading-relaxed text-violet-100 font-medium">
                  La solución completa para automatizar todos tus canales de venta y pedidos de punta a punta.
                </p>

                <div className="mt-6 space-y-3 border-t border-white/15 pt-5 text-xs sm:text-sm text-violet-100 font-medium">
                  <div className="flex items-center gap-2.5">
                    <iconify-icon icon="solar:check-circle-bold" width="18" height="18" className="text-emerald-300 shrink-0"></iconify-icon>
                    <span><strong>10.000 respuestas con IA al mes</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <iconify-icon icon="solar:check-circle-bold" width="18" height="18" className="text-emerald-300 shrink-0"></iconify-icon>
                    <span><strong>Multicanal Simultáneo:</strong> WhatsApp <u>e</u> Instagram</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <iconify-icon icon="solar:check-circle-bold" width="18" height="18" className="text-emerald-300 shrink-0"></iconify-icon>
                    <span><strong>Catálogo E-commerce 100% a tu medida</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <iconify-icon icon="solar:check-circle-bold" width="18" height="18" className="text-emerald-300 shrink-0"></iconify-icon>
                    <span>Agentes con memoria infinita y segmentación</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <iconify-icon icon="solar:check-circle-bold" width="18" height="18" className="text-emerald-300 shrink-0"></iconify-icon>
                    <span>CRM Avanzado + Control de inventario en tiempo real</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <iconify-icon icon="solar:check-circle-bold" width="18" height="18" className="text-emerald-300 shrink-0"></iconify-icon>
                    <span>Seguimiento y recuperación de ventas en chat</span>
                  </div>
                </div>
              </div>

              <a href="#diagnostico" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-xs sm:text-sm font-extrabold text-[#7C3AED] shadow-xl transition hover:bg-violet-50">
                Quiero la Solución Completa $70
                <iconify-icon icon="solar:arrow-right-linear" width="16" height="16"></iconify-icon>
              </a>
            </div>
          </div>

          {/* Zero Commission Guarantee Card */}
          <div className="mt-8 overflow-hidden rounded-2xl border border-emerald-500/30 bg-[#0f1915] p-5 sm:p-7 text-white shadow-xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  <iconify-icon icon="solar:shield-check-bold" width="24" height="24"></iconify-icon>
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-emerald-300">Garantía de Cero Comisiones</h4>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                    Pagas únicamente tu suscripción fija ($50 o $70). El 100% de lo que vendes es tuyo.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500 px-3.5 py-1 text-xs font-black text-slate-950 uppercase tracking-wider shrink-0 shadow-md">
                100% Tu Margen
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. UNIFIED DIAGNÓSTICO CON IA + PREGUNTAS FRECUENTES (PWA OPTIMIZED)      */}
      {/* ========================================================================= */}
      <section id="diagnostico" className="relative overflow-hidden bg-[#0c0418] py-16 sm:py-20 text-white border-t border-white/5">
        <div className="pointer-events-none absolute -left-20 top-16 h-80 w-80 rounded-full bg-violet-700/20 blur-3xl"></div>
        <div className="pointer-events-none absolute -right-20 bottom-16 h-80 w-80 rounded-full bg-fuchsia-700/20 blur-3xl"></div>
        
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 md:px-8">
          
          {/* Unified Header */}
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/15 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-violet-300">
              Inicia tu Diagnóstico o Resuelve tus Dudas
            </span>
            <h2 className="mt-3.5 text-2xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
              Habla en vivo con nuestro Agente de IA.
            </h2>
            <p className="mt-3 text-xs sm:text-base leading-relaxed text-slate-300 font-medium">
              Sin formularios lentos. Chatea directamente con nuestro agente en WhatsApp o Instagram y recibe una auditoría de ventas en 5 minutos.
            </p>
          </div>

          {/* Direct Interactive Channel Cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {/* Card 1: WhatsApp Directo */}
            <a 
              href="https://wa.me/584149189169?text=Hola%2C%20quiero%20hacer%20el%20diagn%C3%B3stico%20gratis%20con%20Flow%20para%20mi%20empresa" 
              target="_blank" 
              rel="noopener noreferrer"
              className="card-glow group relative flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/40 to-slate-950 p-5 sm:p-6 transition duration-300 hover:border-emerald-400 hover:-translate-y-1 shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <iconify-icon icon="logos:whatsapp-icon" width="22" height="22"></iconify-icon>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    Agente Activo 24/7
                  </span>
                </div>

                <h3 className="mt-3.5 text-lg sm:text-xl font-extrabold text-white">Chatear por WhatsApp</h3>
                <p className="mt-0.5 text-xs font-mono text-emerald-400">+58 0414 918 9169</p>
                
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Inicia la conversación en WhatsApp. Te responderá de inmediato con una propuesta para tu negocio.
                </p>
              </div>

              <div className="mt-5 flex items-center justify-center gap-2 rounded-full bg-emerald-500 py-3 text-xs font-extrabold text-slate-950 transition duration-200 group-hover:bg-emerald-400 shadow-md">
                <span>Iniciar en WhatsApp</span>
                <iconify-icon icon="solar:arrow-right-linear" width="15" height="15"></iconify-icon>
              </div>
            </a>

            {/* Card 2: Instagram Directo */}
            <a 
              href="https://ig.me/m/martes.app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="card-glow group relative flex flex-col justify-between rounded-2xl border border-fuchsia-500/30 bg-gradient-to-b from-fuchsia-950/40 to-slate-950 p-5 sm:p-6 transition duration-300 hover:border-fuchsia-400 hover:-translate-y-1 shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30">
                    <iconify-icon icon="skill-icons:instagram" width="22" height="22"></iconify-icon>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-fuchsia-500/10 px-2.5 py-0.5 text-[10px] font-bold text-fuchsia-400 border border-fuchsia-500/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400 animate-ping"></span>
                    DM Abierto 24/7
                  </span>
                </div>

                <h3 className="mt-3.5 text-lg sm:text-xl font-extrabold text-white">Chatear por Instagram</h3>
                <p className="mt-0.5 text-xs font-mono text-fuchsia-400">@martes.app</p>
                
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Escríbenos por mensaje directo (DM) en Instagram y prueba en tiempo real cómo responde nuestro agente con catálogo.
                </p>
              </div>

              <div className="mt-5 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-xs font-extrabold text-white transition duration-200 group-hover:from-fuchsia-500 group-hover:to-violet-500 shadow-md">
                <span>Abrir DM @martes.app</span>
                <iconify-icon icon="solar:arrow-right-linear" width="15" height="15"></iconify-icon>
              </div>
            </a>
          </div>

          {/* Edge-to-Edge Collapsible FAQ Bar */}
          <div className="mt-8">
            <button 
              type="button" 
              onClick={() => setFaqExpanded(!faqExpanded)}
              className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-violet-400/40 transition duration-300 shadow-lg text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 group-hover:bg-[#7C3AED] group-hover:text-white transition">
                  <iconify-icon icon="solar:question-circle-bold" width="20" height="20"></iconify-icon>
                </span>
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-white">
                    {faqExpanded ? 'Ocultar Preguntas Frecuentes' : 'Preguntas Frecuentes antes de empezar'}
                  </p>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium">Toca para ver respuestas sobre comisiones, números y catálogo</p>
                </div>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-violet-300 group-hover:bg-white group-hover:text-slate-950 transition">
                <iconify-icon icon="solar:alt-arrow-down-linear" width="18" height="18" className={`transition duration-300 ${faqExpanded ? 'rotate-180' : ''}`}></iconify-icon>
              </div>
            </button>
          </div>

          {/* Collapsible FAQ Content */}
          {faqExpanded && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6 backdrop-blur-lg space-y-4 transition-all duration-500">
              <div className="border-b border-white/10 pb-3.5">
                <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <iconify-icon icon="solar:check-circle-bold" className="text-emerald-400"></iconify-icon>
                  ¿Tengo que cambiar mi número de WhatsApp actual?
                </p>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed font-medium pl-6">
                  No. Conectamos Flow a tu número actual mediante la API Oficial de Meta. Tus clientes te siguen escribiendo al mismo contacto de siempre.
                </p>
              </div>

              <div className="border-b border-white/10 pb-3.5">
                <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <iconify-icon icon="solar:check-circle-bold" className="text-emerald-400"></iconify-icon>
                  ¿Flow se queda con alguna comisión de mis ventas?
                </p>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed font-medium pl-6">
                  Cero comisiones. Pagas únicamente tu mensualidad fija ($50 o $70). Todos los cobros (Pago Móvil, Zelle, efectivo) van 100% a tus cuentas.
                </p>
              </div>

              <div className="border-b border-white/10 pb-3.5">
                <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <iconify-icon icon="solar:check-circle-bold" className="text-emerald-400"></iconify-icon>
                  ¿Cómo es el montaje del catálogo y la carga de productos?
                </p>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed font-medium pl-6">
                  Nosotros realizamos la configuración técnica y te asistimos con la carga de fotos y precios para que tu catálogo quede listo en 48 horas.
                </p>
              </div>

              <div>
                <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <iconify-icon icon="solar:check-circle-bold" className="text-emerald-400"></iconify-icon>
                  ¿Puedo responder personalmente cuando yo quiera?
                </p>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed font-medium pl-6">
                  Sí, 100%. Tú y tu equipo pueden intervenir en cualquier conversación en un clic. En ese momento la IA se pausa y vuelve cuando tú decidas.
                </p>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-[11px] font-medium text-slate-400">
            💡 Respuesta en segundos · Sin compromiso comercial · 100% enfocado en tu empresa
          </p>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. FOOTER (Enhanced with bold modern MARTES APP typography)               */}
      {/* ========================================================================= */}
      <footer className="bg-[#07020f] text-white border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:px-8">
          <div className="flex flex-col gap-6 border-b border-white/10 pb-8 md:flex-row md:items-center md:justify-between">
            <Link href="#inicio" className="flex items-center gap-2" aria-label="Flow, volver al inicio">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7C3AED] text-white shadow-md">
                <iconify-icon icon="solar:bolt-bold-duotone" width="20" height="20"></iconify-icon>
              </span>
              <div className="flex flex-col text-left">
                <span className="text-lg font-bold tracking-tight">Flow</span>
                <span className="text-[9px] text-violet-400 font-bold uppercase tracking-wider">by Martes</span>
              </div>
            </Link>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs sm:text-sm text-slate-400 font-semibold">
              <a href="#video" className="transition hover:text-white">Video</a>
              <a href="#catalogo-demo" className="transition hover:text-white">Demo Don Luigi</a>
              <a href="#control" className="transition hover:text-white">Tu control</a>
              <a href="#precio" className="transition hover:text-white">Precios</a>
              <a href="#diagnostico" className="transition hover:text-white">Diagnóstico & FAQs</a>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-6 text-[11px] sm:text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between font-medium">
            <p>© {currentYear} Flow by Martes. Todos los derechos reservados.</p>
            <p>Ventas más simples. Negocios que escalan sin límites.</p>
          </div>

          <div className="mt-10 pt-6 border-t border-white/5 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-violet-400/80 mb-1.5">Desarrollado por</span>
            <h2 className="font-display text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter uppercase bg-gradient-to-b from-white/25 via-white/10 to-transparent bg-clip-text text-transparent select-none">
              MARTES APP
            </h2>
          </div>
        </div>
      </footer>
    </div>
  );
}

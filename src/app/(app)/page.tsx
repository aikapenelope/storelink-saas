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

          <div className="hidden items-center gap-7 text-sm font-semibold text-slate-700 md:flex">
            <a href="#como-funciona" className="transition hover:text-[#7C3AED]">Cómo funciona</a>
            <a href="#todo-en-uno" className="transition hover:text-[#7C3AED]">Qué incluye</a>
            <a href="#catalogo-demo" className="transition hover:text-[#7C3AED]">Catálogo E-commerce</a>
            <a href="#control" className="transition hover:text-[#7C3AED]">Tu control</a>
            <a href="#precio" className="transition hover:text-[#7C3AED]">Precios</a>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/15 bg-white/90 px-4 py-2.5 text-xs font-extrabold text-slate-900 shadow-sm backdrop-blur transition hover:bg-slate-950 hover:text-white"
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

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-900/10 bg-white/80 text-slate-900 shadow-sm backdrop-blur md:hidden"
            aria-label="Abrir menú"
          >
            <iconify-icon icon={mobileMenuOpen ? "solar:close-circle-bold" : "solar:hamburger-menu-linear"} width="22" height="22"></iconify-icon>
          </button>
        </nav>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="relative z-50 mx-5 rounded-2xl border border-white/60 bg-white/95 p-5 shadow-2xl backdrop-blur-lg md:hidden animate-in fade-in duration-200">
            <div className="flex flex-col gap-1 text-sm font-semibold text-slate-800">
              <a href="#como-funciona" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-violet-50">Cómo funciona</a>
              <a href="#todo-en-uno" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-violet-50">Qué incluye</a>
              <a href="#catalogo-demo" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-violet-50">Catálogo E-commerce</a>
              <a href="#control" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-violet-50">Tu control</a>
              <a href="#precio" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-violet-50">Precios</a>
              
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-violet-100 text-[#7C3AED] px-4 py-3 text-center font-bold"
              >
                <iconify-icon icon="solar:user-bold" width="16" height="16"></iconify-icon>
                <span>Login Comerciantes</span>
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
              <iconify-icon icon="solar:arrow-right-linear" width="18" height="18" className="transition group-hover:translate-x-1"></iconify-icon>
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

          {/* Floating Ambient Cards */}
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

          {/* CRM Dashboard Preview Widget */}
          <div className="mt-14 w-full max-w-5xl rounded-2xl border border-neutral-800 bg-black/90 p-2 shadow-2xl shadow-black/90 backdrop-blur-2xl md:p-3 relative z-20">
            <div className="overflow-hidden rounded-xl border border-neutral-800 bg-[#000000] text-left text-white shadow-2xl">
              {/* Top Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 bg-[#0a0a0a] px-4 py-2.5 sm:px-5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-white text-black font-black text-[11px]">FL</span>
                  <span className="font-extrabold text-white">Flow by Martes</span>
                  <span className="text-neutral-600">/</span>
                  <span className="font-bold text-emerald-400">Don Luigi & Burgers</span>
                  <span className="hidden sm:inline-block rounded bg-neutral-900 px-2 py-0.5 text-[10px] font-mono text-neutral-300 border border-neutral-800">donluigi.martes.app</span>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Link href="/demo" className="inline-flex items-center gap-1.5 rounded bg-white px-3 py-1 text-black hover:bg-neutral-200 transition shadow-sm text-[11px] font-bold">
                    <iconify-icon icon="solar:shop-2-bold" width="13" height="13"></iconify-icon>
                    <span>Ver Tienda PWA</span>
                  </Link>
                  <Link href="/admin" className="hidden sm:inline-flex items-center gap-1 rounded bg-neutral-900 px-2.5 py-1 text-neutral-200 hover:bg-neutral-800 border border-neutral-800 transition text-[11px]">
                    <iconify-icon icon="solar:user-bold" width="13" height="13" className="text-emerald-400"></iconify-icon>
                    Acceso Admin
                  </Link>
                </div>
              </div>

              {/* CRM Layout */}
              <div className="grid lg:grid-cols-[12.5rem_1fr] min-h-[25rem]">
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

                  <div className="rounded border border-emerald-500/30 bg-emerald-950/20 p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Agente Conectado
                    </div>
                    <p className="mt-1 text-[10px] text-neutral-400 leading-tight">Cerrando ventas en WhatsApp e Instagram.</p>
                  </div>
                </aside>

                <div className="bg-[#000000] p-3.5 sm:p-4 space-y-3">
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

                  <div className="grid gap-2.5 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-2.5">
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
            <div className="card-glow rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-8 backdrop-blur-xl transition duration-300 hover:border-violet-400/60 hover:-translate-y-1">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-[#7C3AED] text-white shadow-lg shadow-violet-500/30">
                <iconify-icon icon="solar:moon-stars-bold-duotone" width="28" height="28"></iconify-icon>
              </div>
              <h3 className="mt-6 text-xl font-bold tracking-tight text-white">Ventas activas 24/7 mientras duermes</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Tus clientes pueden consultar, armar pedidos y pagar a las 11:00 p. m. o un domingo por la mañana. Flow responde en segundos con precisión quirúrgica.
              </p>
            </div>

            <div className="card-glow rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-8 backdrop-blur-xl transition duration-300 hover:border-emerald-400/60 hover:-translate-y-1">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
                <iconify-icon icon="solar:dollar-minimalistic-bold-duotone" width="28" height="28"></iconify-icon>
              </div>
              <h3 className="mt-6 text-xl font-bold tracking-tight text-white">0% Comisiones: Todo el margen es tuyo</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                No te quitamos porcentaje de tus ventas. Tienes la potencia de un Shopify integrado con agentes de IA de última generación por una tarifa plana insuperable.
              </p>
            </div>

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
              Conectamos tus conversaciones de WhatsApp e Instagram con tu e-commerce, CRM, inventario y equipo en un solo ecosistema inteligente.
            </p>
          </div>

          <div className="mt-16 grid gap-6 lg:grid-cols-2">
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
                Responden dudas complejas, envían fotos de productos, recomiendan opciones, recuperan carritos abandonados y concretan pagos las 24 horas.
              </p>
            </article>

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
                Tus clientes ven fotos en alta resolución, precios en dólares o bolívares y compran en 2 clics desde su celular con checkout instantáneo.
              </p>
            </article>
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
              Un e-commerce ultra veloz, visual y diseñado para vender. Puedes simular compras reales desde el catálogo aquí mismo.
            </p>
          </div>

          <div className="card-glow-strong relative mt-12 overflow-hidden rounded-3xl border border-slate-800 bg-[#0f0a1c] p-2.5 md:p-4 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#160f27] px-4 py-3 text-white border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500"></span>
                <span className="h-3 w-3 rounded-full bg-amber-500"></span>
                <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
                <span className="ml-2 hidden text-xs font-bold text-slate-300 sm:inline">Tienda PWA Demo · Flow by Martes</span>
              </div>

              <div className="flex flex-1 max-w-md items-center justify-center">
                <div className="flex w-full items-center gap-2 rounded-xl bg-slate-900 px-4 py-1.5 text-xs text-slate-300 font-mono border border-white/10">
                  <iconify-icon icon="solar:lock-bold" className="text-emerald-400" width="14" height="14"></iconify-icon>
                  <span className="truncate">https://flow.martes.app/demo</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/demo"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#7C3AED] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-violet-600 shadow-md"
                >
                  <span>Abrir en pantalla completa</span>
                  <iconify-icon icon="solar:arrow-right-up-linear" width="14" height="14"></iconify-icon>
                </Link>
              </div>
            </div>

            <div className="relative h-[48rem] w-full overflow-hidden rounded-b-2xl bg-slate-100">
              <iframe
                id="catalogFrame"
                src="/demo"
                title="Catálogo E-commerce Demo Flow"
                className="h-full w-full border-0"
                loading="lazy"
                allow="payment; geolocation"
              ></iframe>
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
              Tienes la potencia de un Shopify + Agentes de IA en WhatsApp e Instagram por una tarifa plana insuperable.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto">
            {/* Plan 1: $50 */}
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
                    <span>CRM básico de pedidos y clientes</span>
                  </div>
                </div>
              </div>

              <a
                href="#diagnostico"
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-950 bg-slate-950 py-4 text-sm font-bold text-white transition hover:bg-[#7C3AED] hover:border-[#7C3AED]"
              >
                Comenzar con Plan $50
                <iconify-icon icon="solar:arrow-right-linear" width="18" height="18"></iconify-icon>
              </a>
            </div>

            {/* Plan 2: $70 */}
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
                    <span>CRM Avanzado + Control de inventario en tiempo real</span>
                  </div>
                </div>
              </div>

              <a
                href="#diagnostico"
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white py-4 text-sm font-extrabold text-[#7C3AED] shadow-xl transition hover:bg-violet-50"
              >
                Quiero la Solución Completa $70
                <iconify-icon icon="solar:arrow-right-linear" width="18" height="18"></iconify-icon>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* DIRECT & INTERACTIVE AI DIAGNOSTIC                                        */}
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
              Chatea directamente con nuestro agente inteligente en WhatsApp o Instagram y recibe una propuesta personalizada en 5 minutos.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 max-w-4xl mx-auto">
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
                  Inicia la conversación directo con nuestro agente. Te mostrará cómo Flow automatizará tus pedidos.
                </p>
              </div>

              <div className="mt-8 flex items-center justify-center gap-2 rounded-full bg-emerald-500 py-3.5 text-sm font-extrabold text-slate-950 transition duration-200 group-hover:bg-emerald-400 shadow-lg">
                <span>Iniciar Diagnóstico en WhatsApp</span>
                <iconify-icon icon="solar:arrow-right-linear" width="18" height="18"></iconify-icon>
              </div>
            </a>

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
                  Escríbenos por mensaje directo en Instagram y prueba en tiempo real la experiencia.
                </p>
              </div>

              <div className="mt-8 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3.5 text-sm font-extrabold text-white transition duration-200 group-hover:from-fuchsia-500 group-hover:to-violet-500 shadow-lg">
                <span>Abrir DM en Instagram @martes.app</span>
                <iconify-icon icon="solar:arrow-right-linear" width="18" height="18"></iconify-icon>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* FOOTER                                                                    */}
      {/* ========================================================================= */}
      <footer className="bg-[#07020f] text-white">
        <div className="mx-auto max-w-7xl px-5 py-14 md:px-8">
          <div className="flex flex-col gap-8 border-b border-white/10 pb-12 md:flex-row md:items-center md:justify-between">
            <Link href="#inicio" className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED] text-white shadow-lg">
                <iconify-icon icon="solar:bolt-bold-duotone" width="22" height="22"></iconify-icon>
              </span>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight">Flow</span>
                <span className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">by Martes</span>
              </div>
            </Link>

            <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-400 font-semibold">
              <a href="#como-funciona" className="transition hover:text-white">Cómo funciona</a>
              <a href="#todo-en-uno" className="transition hover:text-white">Qué incluye</a>
              <a href="#catalogo-demo" className="transition hover:text-white">Catálogo Demo</a>
              <Link href="/admin" className="text-violet-400 hover:text-violet-300 font-bold">Login Admin</Link>
              <a href="#precio" className="transition hover:text-white">Precios</a>
              <a href="#diagnostico" className="transition hover:text-white">Contacto</a>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-8 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between font-medium">
            <p>© {currentYear} Flow by Martes. Todos los derechos reservados.</p>
            <p className="flex items-center gap-2">
              <span>Ventas más simples. Negocios que escalan sin límites.</span>
            </p>
          </div>

          <div className="mt-14 pt-8 border-t border-white/5 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.35em] text-violet-400/80 mb-2">Desarrollado con orgullo por</span>
            <h2 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter uppercase bg-gradient-to-b from-white/25 via-white/10 to-transparent bg-clip-text text-transparent select-none">
              MARTES APP
            </h2>
          </div>
        </div>
      </footer>
    </div>
  );
}

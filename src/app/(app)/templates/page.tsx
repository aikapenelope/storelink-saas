'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { THEME_METAS, type ThemeMeta } from '@/data/theme-presets';

export default function TemplatesPage() {
  const [selectedThemeId, setSelectedThemeId] = useState<string>('food-delivery');
  const [viewMode, setViewMode] = useState<'mobile' | 'fullscreen'>('mobile');

  const selectedTheme: ThemeMeta =
    THEME_METAS.find((t) => t.id === selectedThemeId) || THEME_METAS[0];

  return (
    <div className="min-h-screen bg-[#0c0418] text-white antialiased selection:bg-violet-500 selection:text-white font-sans">
      {/* Ambient Glows */}
      <div className="pointer-events-none fixed left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]"></div>
      <div className="pointer-events-none fixed right-0 top-1/3 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-[100px]"></div>

      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0c0418]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="Volver al inicio">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7C3AED] text-white shadow-md shadow-violet-500/30 ring-2 ring-white/70">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <div className="flex flex-col text-left">
              <span className="text-lg font-extrabold tracking-tight text-white leading-tight">Flow</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-violet-400">Templates</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-slate-300 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              ← Volver al Inicio
            </Link>
            <a
              href="https://wa.me/584120000000?text=Hola,%20me%20interesa%20una%20tienda%20online%20con%20dise%C3%B1o%20a%20medida%20en%20Flow"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-violet-600/30 transition hover:brightness-110"
            >
              <span>Solicitar a Medida</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="relative px-4 pt-10 pb-6 sm:px-6 lg:px-8 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/15 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-violet-300 mb-3">
          Catálogo Oficial de Plantillas ({THEME_METAS.length} Diseños)
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
          Elige la estética ideal para tu negocio o la{' '}
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
            creamos 100% a tu medida
          </span>
        </h1>
        <p className="mt-3 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Nuestras plantillas están optimizadas para carga ultra-rápida, pedidos automatizados por WhatsApp y cobro directo en dólares o Bolívares. Selecciona una plantilla para probarla en vivo:
        </p>
      </section>

      {/* Theme Selection Grid / Pills */}
      <section className="px-4 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
          {THEME_METAS.map((theme) => {
            const isSelected = theme.id === selectedThemeId;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => setSelectedThemeId(theme.id)}
                className={`flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 border ${
                  isSelected
                    ? 'bg-violet-600 border-violet-400 text-white shadow-lg shadow-violet-600/30 scale-105'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <span className="text-base leading-none">{theme.emoji}</span>
                <span>{theme.name}</span>
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-md bg-black/30 text-violet-200">
                  {theme.category}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Interactive Live Preview Viewport Area */}
      <main className="px-4 py-6 max-w-7xl mx-auto">
        <div className="rounded-3xl border border-white/15 bg-slate-900/60 backdrop-blur-2xl p-3 sm:p-5 shadow-2xl">
          {/* Top Preview Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10 px-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedTheme.emoji}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-extrabold text-white">{selectedTheme.name}</h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    {selectedTheme.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-1">{selectedTheme.description}</p>
              </div>
            </div>

            {/* View Mode Toggle & Standalone Link */}
            <div className="flex items-center gap-2">
              <div className="bg-black/40 p-1 rounded-xl border border-white/10 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setViewMode('mobile')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    viewMode === 'mobile'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📱 Móvil PWA
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('fullscreen')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    viewMode === 'fullscreen'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🖥️ Pantalla Completa
                </button>
              </div>

              <a
                href={`/demo?theme=${selectedTheme.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition border border-white/10"
              >
                <span>Abrir en pestaña</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>

          {/* Iframe Viewport */}
          <div className="relative mt-4 flex justify-center items-center">
            {viewMode === 'mobile' ? (
              <div className="relative w-full max-w-sm sm:max-w-md h-[40rem] sm:h-[48rem] rounded-[2.5rem] p-3.5 bg-slate-950 border-4 border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
                {/* Mobile Camera Notch */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 h-4 w-28 bg-slate-900 rounded-full z-20"></div>
                <div className="h-full w-full overflow-hidden rounded-[2rem] bg-white">
                  <iframe
                    key={selectedTheme.id}
                    src={`/demo?theme=${selectedTheme.id}`}
                    title={`Demo ${selectedTheme.name}`}
                    className="h-full w-full border-0"
                    loading="lazy"
                    allow="payment; geolocation"
                  />
                </div>
              </div>
            ) : (
              <div className="w-full h-[44rem] sm:h-[52rem] rounded-2xl overflow-hidden bg-white border border-slate-800 shadow-2xl">
                <iframe
                  key={selectedTheme.id}
                  src={`/demo?theme=${selectedTheme.id}`}
                  title={`Demo ${selectedTheme.name}`}
                  className="h-full w-full border-0"
                  loading="lazy"
                  allow="payment; geolocation"
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bespoke Custom Store Tailoring Callout Banner */}
      <section className="px-4 py-12 max-w-7xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-950/60 via-[#13072b] to-black p-6 sm:p-10 shadow-2xl">
          <div className="pointer-events-none absolute right-0 bottom-0 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-[80px]"></div>

          <div className="relative z-10 grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-8 space-y-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
                ✨ Desarrollo & Diseño a Medida
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                ¿Tienes una referencia o quieres un diseño 100% exclusivo?
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                Si viste una tienda online que te gusta (en Shopify, Zara, Apple o cualquier marca de referencia), o tienes un diseño en Figma, <strong>nuestro equipo de ingeniería lo replica y adapta a la medida de tu marca</strong> con todas las ventajas de Flow: 0% comisiones, catálogo en la nube y checkout directo a WhatsApp con recibo PDF.
              </p>
            </div>

            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-center">
              <a
                href="https://wa.me/584120000000?text=Hola,%20tengo%20una%20referencia%20de%20dise%C3%B1o%20y%20quiero%20hacer%20mi%20tienda%20a%20medida%20con%20Flow"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-6 py-3.5 text-xs sm:text-sm transition shadow-lg shadow-emerald-600/30 active:scale-95"
              >
                <span>Cotizar Diseño a Medida</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>

              <Link
                href="/admin"
                className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold px-6 py-3 text-xs transition border border-white/10"
              >
                <span>Crear Tienda en Panel</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#070110] py-8 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Flow by Martes. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

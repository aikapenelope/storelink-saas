'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { THEME_METAS, type ThemeMeta } from '@/data/theme-presets';

const WHATSAPP_PHONE = '584149189169';

const CATEGORIES = [
  'Todos',
  'Gastronomía',
  'Moda',
  'Industria',
  'B2B',
  'Tech',
  'Comercio General',
];

export default function TemplatesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  const filteredThemes = useMemo(() => {
    if (selectedCategory === 'Todos') return THEME_METAS;
    return THEME_METAS.filter((theme) => theme.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="min-h-screen bg-[#0c0418] text-white antialiased selection:bg-violet-500 selection:text-white font-sans">
      {/* Ambient Glows */}
      <div className="pointer-events-none fixed left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]"></div>
      <div className="pointer-events-none fixed right-0 top-1/3 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-[100px]"></div>

      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0c0418]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Volver al inicio">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7C3AED] text-white shadow-md shadow-violet-500/30 ring-2 ring-white/70">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <div className="flex flex-col text-left">
              <span className="text-base sm:text-lg font-extrabold tracking-tight text-white leading-tight">Flow</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-violet-400">Plantillas</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-slate-300 hover:text-white transition px-2.5 py-1.5 rounded-lg hover:bg-white/5"
            >
              ← <span className="hidden sm:inline">Volver al</span> Inicio
            </Link>
            <a
              href={`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent('Hola, me interesa una tienda online con diseño a medida en Flow')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-violet-600/30 transition hover:brightness-110 active:scale-95 flex-shrink-0"
            >
              <span>Diseño a Medida</span>
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
          Catálogo Oficial ({THEME_METAS.length} Plantillas)
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
          Elige la plantilla de tu nicho o la{' '}
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
            fabricamos a tu medida
          </span>
        </h1>
        <p className="mt-3 text-xs sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Nuestras plantillas están optimizadas para carga ultra-rápida en celulares, 0% comisiones, catálogo en la nube y pedidos automáticos por WhatsApp con recibo PDF y cobro en USD o Bolívares.
        </p>
      </section>

      {/* Category Filter Pills */}
      <section className="px-4 py-3 max-w-7xl mx-auto sticky top-14 z-40 bg-[#0c0418]/90 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
          {CATEGORIES.map((cat) => {
            const isSelected = cat === selectedCategory;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 ${
                  isSelected
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 ring-1 ring-violet-400'
                    : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* Templates Gallery Grid */}
      <main className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredThemes.map((theme: ThemeMeta) => {
            const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
              `Hola, me interesa iniciar mi tienda online con la plantilla ${theme.name} de Flow.`
            )}`;

            return (
              <div
                key={theme.id}
                className="group relative flex flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-xl hover:border-violet-500/50 hover:shadow-2xl hover:shadow-violet-600/10 transition duration-300"
              >
                {/* Image Cover */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-950">
                  <Image
                    src={theme.previewImage}
                    alt={theme.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out opacity-90 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>

                  {/* Top Badge Overlay */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="text-xl">{theme.emoji}</span>
                    <span className="rounded-full bg-black/70 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white border border-white/15">
                      {theme.badge}
                    </span>
                  </div>

                  <span className="absolute top-3 right-3 rounded-full bg-violet-500/80 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                    {theme.category}
                  </span>
                </div>

                {/* Card Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="text-lg font-extrabold text-white group-hover:text-violet-300 transition">
                      {theme.name}
                    </h2>
                    <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                      {theme.description}
                    </p>

                    {/* Feature Highlights */}
                    <div className="mt-4 space-y-1.5 border-t border-white/10 pt-3">
                      {theme.highlights.map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-300 font-medium">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-2.5">
                    <a
                      href={`/demo?theme=${theme.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs py-2.5 px-3 transition shadow-md shadow-violet-600/30 active:scale-95 text-center"
                    >
                      <span>Ver Demo en Vivo</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>

                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs py-2.5 px-3 transition border border-white/10 active:scale-95 text-center"
                    >
                      <span>Elegir</span>
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
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
                Si viste una tienda online que te gusta (en Shopify, Zara, Apple o cualquier marca de referencia), o tienes un diseño en Figma, <strong>nuestro equipo de ingeniería lo replica y adapta a la medida de tu marca</strong> con todas las ventajas de Flow: 0% comisiones, catálogo en la nube y checkout directo a WhatsApp con recibo PDF y cobro en USD o Bolívares.
              </p>
            </div>

            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-center">
              <a
                href={`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent('Hola, tengo una referencia de diseño y quiero hacer mi tienda a medida con Flow')}`}
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
                className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold px-6 py-3 text-xs transition border border-white/10 active:scale-95"
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

'use client';

import React from 'react';

export interface DemoOption {
  id: string;
  name: string;
  shortName: string;
  emoji: string;
  badge: string;
}

export const DEMO_OPTIONS: DemoOption[] = [
  {
    id: 'basic-banner',
    name: 'Plan Básico',
    shortName: 'Básico',
    emoji: '🏷️',
    badge: 'Básico',
  },
  {
    id: 'food-delivery',
    name: 'Don Luigi & Burgers',
    shortName: 'Comida',
    emoji: '🍔',
    badge: 'Comida',
  },
  {
    id: 'fashion-boutique',
    name: 'AURA Studio',
    shortName: 'Moda',
    emoji: '👗',
    badge: 'Moda',
  },
  {
    id: 'moto-parts',
    name: 'El Piloto Pro',
    shortName: 'Motos',
    emoji: '🏍️',
    badge: 'Repuestos',
  },
  {
    id: 'hardware-store',
    name: 'El Maestro',
    shortName: 'Ferretería',
    emoji: '🔧',
    badge: 'Ferretería',
  },
  {
    id: 'b2b-matrix',
    name: 'Matrix B2B',
    shortName: 'B2B',
    emoji: '🏢',
    badge: 'Mayorista',
  },
  {
    id: 'editorial',
    name: 'Maison Alta Gama',
    shortName: 'Editorial',
    emoji: '✨',
    badge: 'Lookbook',
  },
  {
    id: 'fluid-pwa',
    name: 'Fluid Mobile',
    shortName: 'Fluid Mobile',
    emoji: '📱',
    badge: 'Mobile-First',
  },
  {
    id: 'vercel-commerce',
    name: 'Minimal Dark Tech',
    shortName: 'Minimal',
    emoji: '⚡',
    badge: 'Tech',
  },
];

interface DemosMartesSwitcherProps {
  activeTheme: string;
  onSelectTheme: (themeId: string) => void;
}

export function DemosMartesSwitcher({
  activeTheme,
  onSelectTheme,
}: DemosMartesSwitcherProps) {
  return (
    <nav
      role="navigation"
      aria-label="Selector de Demos Martes"
      className="fixed bottom-0 inset-x-0 z-50 bg-slate-950/95 backdrop-blur-xl border-t-2 border-purple-600/70 shadow-[0_-8px_20px_rgba(126,34,206,0.35)] pb-[env(safe-area-inset-bottom,0px)] font-sans"
    >
      {/* Micro header indicator */}
      <div className="flex items-center justify-between px-3 pt-1 pb-0.5 border-b border-purple-900/30 max-w-2xl mx-auto">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
          <span className="text-[9px] font-black uppercase tracking-widest text-purple-300">
            DEMOS MARTES ({DEMO_OPTIONS.length} PLANTILLAS)
          </span>
        </div>
        <span className="text-[8px] font-mono text-purple-300/70 uppercase">
          Desliza y toca para cambiar plantilla
        </span>
      </div>

      {/* Horizontal Scrollable Tab Bar (responsive) */}
      <div className="flex items-center gap-1.5 p-1.5 max-w-3xl mx-auto overflow-x-auto no-scrollbar scroll-smooth">
        {DEMO_OPTIONS.map((opt) => {
          const isSelected = opt.id === activeTheme;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectTheme(opt.id)}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl transition-all flex-shrink-0 active:scale-95 ${
                isSelected
                  ? 'bg-purple-600 text-white font-black shadow-md shadow-purple-600/40 ring-1 ring-purple-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-slate-800'
              }`}
            >
              <span className="text-sm leading-none">{opt.emoji}</span>
              <span
                className={`text-[11px] leading-tight font-bold whitespace-nowrap ${
                  isSelected ? 'text-white' : 'text-slate-300'
                }`}
              >
                {opt.shortName}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}


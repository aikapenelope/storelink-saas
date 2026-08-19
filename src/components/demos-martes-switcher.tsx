'use client';

import React from 'react';
import { Layers } from 'lucide-react';

export interface DemoOption {
  id: string;
  name: string;
  shortName: string;
  emoji: string;
  badge: string;
}

export const DEMO_OPTIONS: DemoOption[] = [
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
    shortName: 'Ropa',
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
    id: 'basic-banner',
    name: 'Variedades',
    shortName: 'Básico',
    emoji: '🏷️',
    badge: 'Básico',
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
      <div className="flex items-center justify-between px-3 pt-1 pb-0.5 border-b border-purple-900/30 max-w-lg mx-auto">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
          <span className="text-[9px] font-black uppercase tracking-widest text-purple-300">
            DEMOS MARTES
          </span>
        </div>
        <span className="text-[8px] font-mono text-purple-300/70 uppercase">
          Toca para cambiar tienda
        </span>
      </div>

      {/* 5-Column Native PWA Tab Grid */}
      <div className="grid grid-cols-5 gap-1 p-1 max-w-lg mx-auto">
        {DEMO_OPTIONS.map((opt) => {
          const isSelected = opt.id === activeTheme;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectTheme(opt.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all active:scale-95 ${
                isSelected
                  ? 'bg-purple-600 text-white font-black shadow-md shadow-purple-600/40 ring-1 ring-purple-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <span className="text-base leading-none mb-0.5">{opt.emoji}</span>
              <span
                className={`text-[10px] leading-tight truncate max-w-full font-bold ${
                  isSelected ? 'text-white' : 'text-slate-400'
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


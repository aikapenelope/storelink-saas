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
    <footer className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-xl border-t-2 border-purple-600/80 shadow-[0_-10px_25px_rgba(126,34,206,0.35)] py-2 px-3 font-sans">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* DEMOS MARTES Brand Badge */}
        <div className="flex items-center gap-1.5 bg-purple-900/90 text-purple-200 px-2.5 py-1.5 rounded-xl border border-purple-400/50 flex-shrink-0 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
          <Layers className="w-3.5 h-3.5 text-purple-300" />
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-white">
            DEMOS MARTES
          </span>
        </div>

        {/* Scrollable / Flex Store Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 justify-end">
          {DEMO_OPTIONS.map((opt) => {
            const isSelected = opt.id === activeTheme;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectTheme(opt.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 flex-shrink-0 ${
                  isSelected
                    ? 'bg-purple-600 text-white font-black shadow-lg shadow-purple-600/50 ring-2 ring-purple-300 scale-105'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white border border-white/5'
                }`}
              >
                <span className="text-sm">{opt.emoji}</span>
                <span className="text-[11px] sm:text-xs">{opt.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </footer>
  );
}


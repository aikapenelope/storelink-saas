'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Layers, ChevronDown, Check } from 'lucide-react';

export interface DemoOption {
  id: string;
  name: string;
  emoji: string;
  badge: string;
  description: string;
}

export const DEMO_OPTIONS: DemoOption[] = [
  {
    id: 'food-delivery',
    name: 'Don Luigi & Burgers',
    emoji: '🍔',
    badge: 'Comida',
    description: 'Pizzas napolitanas, smash burgers y combos.',
  },
  {
    id: 'fashion-boutique',
    name: 'AURA Studio',
    emoji: '👗',
    badge: 'Ropa / Moda',
    description: 'Boutique textil, vestidos y prendas exclusivas.',
  },
  {
    id: 'moto-parts',
    name: 'El Piloto Pro',
    emoji: '🏍️',
    badge: 'Repuestos Motos',
    description: 'Cilindros, frenos, cascos y accesorios.',
  },
  {
    id: 'hardware-store',
    name: 'El Maestro',
    emoji: '🔧',
    badge: 'Ferretería',
    description: 'Herramientas, plomería y cotizaciones.',
  },
  {
    id: 'basic-banner',
    name: 'Variedades Express',
    emoji: '🏷️',
    badge: 'Plan Básico',
    description: 'Catálogo con banner hero y productos destacados.',
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
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeOption =
    DEMO_OPTIONS.find((opt) => opt.id === activeTheme) || DEMO_OPTIONS[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Purple High-Contrast Button (Stands out intentionally) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-3.5 sm:py-2 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs shadow-lg shadow-purple-700/40 border-2 border-purple-400 hover:border-purple-300 transition-all transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-300 uppercase tracking-wider flex-shrink-0"
        title="Cambiar entre demostraciones interactivas de tiendas"
      >
        <span className="flex items-center gap-1 bg-purple-900/90 text-purple-200 px-1.5 py-0.5 rounded-md text-[10px] font-black border border-purple-500/50">
          <Layers className="w-3 h-3 text-purple-300 animate-pulse" />
          DEMOS MARTES
        </span>
        <span className="flex items-center gap-1 text-white font-bold text-xs">
          <span>{activeOption.emoji}</span>
          <span className="hidden sm:inline">{activeOption.badge}</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-purple-200 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 sm:w-80 rounded-2xl bg-slate-950 text-white shadow-2xl border-2 border-purple-500/60 backdrop-blur-2xl z-50 p-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-purple-800/60 mb-1 flex items-center justify-between">
            <span className="text-[11px] font-black text-purple-300 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
              DEMOS MARTES • CATÁLOGOS
            </span>
            <span className="text-[10px] text-purple-400 font-mono">5 Rubros</span>
          </div>

          <div className="space-y-1">
            {DEMO_OPTIONS.map((opt) => {
              const isSelected = opt.id === activeTheme;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onSelectTheme(opt.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between group ${
                    isSelected
                      ? 'bg-purple-600/40 text-white border border-purple-400/50 font-bold'
                      : 'hover:bg-purple-900/30 text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl p-1.5 rounded-lg bg-white/10 group-hover:scale-110 transition-transform">
                      {opt.emoji}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">
                          {opt.name}
                        </span>
                        <span className="text-[9px] bg-purple-900/80 text-purple-300 px-1.5 py-0.2 rounded font-mono">
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

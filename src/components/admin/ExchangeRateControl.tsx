'use client';

import React, { useState } from 'react';
import { DollarSign, RefreshCw, Check, ArrowRight, Zap, ShieldCheck } from 'lucide-react';

interface ExchangeRateControlProps {
  tenantSlug: string;
  tenantName: string;
  initialCustomRate: number | null;
  liveRates: {
    bcv: number;
    binance: number;
    paralelo: number;
  };
}

export function ExchangeRateControl({
  tenantSlug,
  tenantName,
  initialCustomRate,
  liveRates,
}: ExchangeRateControlProps) {
  const [customRate, setCustomRate] = useState<string>(
    initialCustomRate ? initialCustomRate.toString() : ''
  );
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeRate, setActiveRate] = useState<number | null>(initialCustomRate);

  const effectiveRate = activeRate && activeRate > 0 ? activeRate : liveRates.binance;

  const handleSaveRate = async (rateToSave: number | null) => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/${tenantSlug}/exchange-rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchangeRateVES: rateToSave,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar la tasa');

      setActiveRate(rateToSave);
      setCustomRate(rateToSave ? rateToSave.toString() : '');
      setStatusMessage({
        text: rateToSave
          ? `✓ Tasa fijada en Bs. ${rateToSave.toFixed(2)} / $ para ${tenantName}`
          : `✓ Modo automático activo (Binance P2P en vivo)`,
        type: 'success',
      });

      // Clear status message after 4s
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({
        text: `Error: ${err.message || 'No se pudo guardar'}`,
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-zinc-800 bg-zinc-950 p-4 shadow-xl rounded-none font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0 rounded-none">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>Control de Tasa de Cambio (VES / USD)</span>
              <span className="text-[9px] font-mono bg-zinc-900 text-zinc-300 border border-zinc-700 px-1.5 py-0.5 rounded-none">
                {activeRate && activeRate > 0 ? 'Fijada Manual' : 'Automática en Vivo'}
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Esta tasa convierte automáticamente los precios de tu catálogo a Bolívares en WhatsApp y Carrito.
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] text-zinc-500 font-mono block">Tasa Activa en Tienda</span>
          <span className="text-base sm:text-lg font-mono font-extrabold text-white">
            Bs. {effectiveRate.toFixed(2)} <span className="text-xs text-zinc-400 font-normal">/ $</span>
          </span>
        </div>
      </div>

      {/* Live Market Reference Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-3">
        {/* BCV Card */}
        <div className="border border-zinc-800/80 bg-black p-2.5 flex items-center justify-between gap-2 rounded-none">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-zinc-300" /> Tasa Oficial BCV
            </span>
            <span className="font-mono text-sm font-bold text-white block mt-0.5">
              Bs. {liveRates.bcv.toFixed(2)} / $
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleSaveRate(liveRates.bcv)}
            disabled={saving}
            className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-200 hover:text-white text-[10px] font-mono transition rounded-none shrink-0 cursor-pointer"
          >
            Usar BCV
          </button>
        </div>

        {/* Binance P2P Card */}
        <div className="border border-zinc-800/80 bg-black p-2.5 flex items-center justify-between gap-2 rounded-none">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-white" /> Binance P2P en Vivo
            </span>
            <span className="font-mono text-sm font-bold text-white block mt-0.5">
              Bs. {liveRates.binance.toFixed(2)} / $
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleSaveRate(liveRates.binance)}
            disabled={saving}
            className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-200 hover:text-white text-[10px] font-mono transition rounded-none shrink-0 cursor-pointer"
          >
            Usar Binance
          </button>
        </div>
      </div>

      {/* Custom Rate Input & Actions */}
      <div className="pt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-500">Bs.</span>
            <input
              type="number"
              step="0.01"
              min="1"
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
              placeholder={`Ej: ${liveRates.binance.toFixed(2)}`}
              className="w-full bg-black border border-zinc-700 text-white font-mono text-xs pl-9 pr-3 py-2 focus:outline-none focus:border-white rounded-none"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const val = parseFloat(customRate);
              if (isNaN(val) || val <= 0) {
                alert('Por favor ingresa un número válido mayor a 0');
                return;
              }
              handleSaveRate(val);
            }}
            disabled={saving || !customRate}
            className="px-3.5 py-2 bg-white hover:bg-zinc-200 active:bg-zinc-300 disabled:bg-zinc-800 disabled:text-zinc-500 text-black text-xs font-bold transition rounded-none uppercase tracking-wider shrink-0 cursor-pointer font-mono"
          >
            {saving ? 'Guardando...' : 'Fijar Tasa'}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeRate && (
            <button
              type="button"
              onClick={() => handleSaveRate(null)}
              disabled={saving}
              className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-mono transition rounded-none cursor-pointer"
            >
              Restablecer a Automático
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`mt-3 p-2 text-xs font-mono border rounded-none ${
            statusMessage.type === 'success'
              ? 'bg-zinc-900 border-zinc-600 text-white'
              : 'bg-red-950/40 border-red-800 text-red-300'
          }`}
        >
          {statusMessage.text}
        </div>
      )}
    </div>
  );
}

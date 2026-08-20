'use client';

import React, { useState } from 'react';
import { RefreshCw, FileSpreadsheet, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

interface GoogleSheetsSyncWidgetProps {
  tenantSlug: string;
  tenantName: string;
}

export function GoogleSheetsSyncWidget({ tenantSlug, tenantName }: GoogleSheetsSyncWidgetProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    created?: number;
    updated?: number;
    errors?: Array<{ line: number; error: string }>;
  } | null>(null);

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/${tenantSlug}/sync-sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({
          success: false,
          message: data.error || 'Error al sincronizar con Google Sheets',
        });
      } else {
        setResult({
          success: true,
          message: `¡Sincronización exitosa! ${data.created || 0} creados, ${data.updated || 0} actualizados.`,
          created: data.created,
          updated: data.updated,
          errors: data.errors,
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Error de conexión con el servidor',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/90 text-white rounded-2xl p-5 border border-slate-800 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Sincronización de Catálogo en 1 Clic
              <span className="text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                Google Sheets
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              Actualiza precios, categorías y stock de <strong>{tenantName}</strong> desde tu hoja de cálculo.
            </p>
          </div>
        </div>

        <a
          href="https://docs.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition"
        >
          <span>Abrir Google Sheets</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <form onSubmit={handleSync} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <input
          type="url"
          required
          placeholder="Pega aquí la URL pública de tu Google Sheet (ej: https://docs.google.com/spreadsheets/d/...)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 whitespace-nowrap cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Sincronizando...' : 'Sincronizar Ahora'}</span>
        </button>
      </form>

      {result && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-200 ${
            result.success
              ? 'bg-emerald-950/50 border-emerald-700/50 text-emerald-200'
              : 'bg-rose-950/50 border-rose-700/50 text-rose-200'
          }`}
        >
          {result.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="font-semibold leading-relaxed">{result.message}</p>
            {result.errors && result.errors.length > 0 && (
              <p className="text-[11px] text-rose-300">
                {result.errors.length} filas tuvieron advertencias de formato.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

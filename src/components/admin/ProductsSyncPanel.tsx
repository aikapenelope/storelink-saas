'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, FileSpreadsheet, CheckCircle2, AlertCircle, ExternalLink, ArrowRight } from 'lucide-react';

export function ProductsSyncPanel() {
  const [url, setUrl] = useState('');
  const [tenantSlug, setTenantSlug] = useState('aurita');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    created?: number;
    updated?: number;
    errors?: Array<{ line: number; error: string }>;
  } | null>(null);

  // Auto detect current tenant from session / me endpoint or URL
  useEffect(() => {
    async function detectTenant() {
      try {
        const res = await fetch('/api/users/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user?.tenants && data.user.tenants.length > 0) {
            const firstTenant = data.user.tenants[0].tenant;
            if (typeof firstTenant === 'object' && firstTenant?.slug) {
              setTenantSlug(firstTenant.slug);
            } else if (typeof firstTenant === 'string' || typeof firstTenant === 'number') {
              // Fetch tenant doc
              const tRes = await fetch(`/api/tenants/${firstTenant}`);
              if (tRes.ok) {
                const tData = await tRes.json();
                if (tData.slug) setTenantSlug(tData.slug);
              }
            }
          }
        }
      } catch (e) {
        // Fallback to aurita
      }
    }
    detectTenant();
  }, []);

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
        setTimeout(() => {
          window.location.reload();
        }, 1500);
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
    <div className="w-full mb-6 border border-zinc-800 bg-black text-zinc-100 p-4 shadow-2xl font-sans rounded-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0 rounded-none">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>Sincronización Instantánea de Productos</span>
              <span className="text-[10px] font-mono bg-zinc-900 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-none">
                Google Sheets
              </span>
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Pega tu enlace público de Google Sheets para crear o actualizar precios, categorías, stock e imágenes en 1 clic.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`https://flow.martes.app/${tenantSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-400 hover:text-white transition inline-flex items-center gap-1 font-mono border border-zinc-800 bg-zinc-950 px-2.5 py-1 rounded-none"
          >
            <span>Tienda: /{tenantSlug}</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>
        </div>
      </div>

      <form onSubmit={handleSync} className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <input
          type="url"
          required
          placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 px-3.5 py-2 bg-zinc-950 border border-zinc-700 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white font-mono rounded-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-white hover:bg-zinc-200 active:bg-zinc-300 disabled:bg-zinc-800 disabled:text-zinc-500 text-black text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg whitespace-nowrap cursor-pointer shrink-0 rounded-none uppercase tracking-wider"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Sincronizando...' : 'Sincronizar Catálogo'}</span>
        </button>
      </form>

      {result && (
        <div
          className={`mt-3 p-3 border text-xs flex items-start gap-2.5 animate-in fade-in duration-200 rounded-none ${
            result.success
              ? 'bg-zinc-900 border-zinc-700 text-white'
              : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}
        >
          {result.success ? (
            <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
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

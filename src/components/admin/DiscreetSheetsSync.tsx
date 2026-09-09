'use client';

import React, { useState } from 'react';
import { FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { pollImportCompletion } from './import-status';

export function DiscreetSheetsSync() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setStatus(null);

    try {
      // Determine active tenant slug dynamically from session
      let tenantSlug = '';
      const meRes = await fetch('/api/users/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        const firstTenant = meData.user?.tenants?.[0]?.tenant;
        if (typeof firstTenant === 'object' && firstTenant?.slug) {
          tenantSlug = firstTenant.slug;
        } else if (firstTenant) {
          const tRes = await fetch(`/api/tenants/${firstTenant}`);
          if (tRes.ok) {
            const tData = await tRes.json();
            if (tData.slug) tenantSlug = tData.slug;
          }
        }
      }

      if (!tenantSlug) {
        throw new Error('No se pudo identificar la tienda activa. Por favor recarga el panel.');
      }

      const res = await fetch(`/api/${tenantSlug}/sync-sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus({ type: 'error', msg: data.error || 'Error al sincronizar' });
      } else {
        // Review Devin #72: polling del resultado real del job (created/
        // updated/rejectedImageUrls) en vez de un "en cola" genérico.
        const jobId = data?.jobId != null ? String(data.jobId) : null;
        if (jobId) {
          const outcome = await pollImportCompletion(tenantSlug, jobId);
          setStatus({
            type: outcome.summary.success ? 'success' : 'error',
            msg: outcome.summary.message,
          });
        } else {
          setStatus({
            type: 'success',
            msg: '¡Catálogo sincronizado con éxito! Actualizando vista...',
          });
        }
        setTimeout(() => {
          window.location.reload();
        }, 2500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de red';
      setStatus({ type: 'error', msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4 p-3 bg-slate-900/40 dark:bg-slate-900/80 border border-slate-800 rounded-xl text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-slate-300">
        <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="font-semibold text-slate-200">Sincronización Rápida (Google Sheets):</span>
        <span className="text-slate-400 hidden lg:inline">Actualiza inventario y precios pegando el enlace de tu hoja pública.</span>
      </div>

      <form onSubmit={handleSync} className="flex items-center gap-2">
        <input
          type="url"
          required
          placeholder="https://docs.google.com/spreadsheets/d/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="px-3 py-1.5 bg-slate-950/80 border border-slate-700/60 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 min-w-[240px]"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition text-xs flex items-center gap-1.5 shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Sincronizando...' : 'Sincronizar'}</span>
        </button>
      </form>

      {status && (
        <div
          className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
            status.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
              : 'bg-rose-950/80 text-rose-400 border border-rose-800'
          }`}
        >
          {status.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          <span>{status.msg}</span>
        </div>
      )}
    </div>
  );
}

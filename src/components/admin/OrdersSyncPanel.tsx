'use client';

import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, RefreshCw, ExternalLink } from 'lucide-react';
import type { Order } from '@/payload-types';

export function OrdersSyncPanel() {
  const [tenantSlug, setTenantSlug] = useState('');
  const [exporting, setExporting] = useState(false);
  const [orderCount, setOrderCount] = useState<number | null>(null);

  // Auto detect current tenant from session / me endpoint
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
              const tRes = await fetch(`/api/tenants/${firstTenant}`);
              if (tRes.ok) {
                const tData = await tRes.json();
                if (tData.slug) setTenantSlug(tData.slug);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Error detectando tienda para pedidos:', e);
      }
    }
    detectTenant();
  }, []);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      // Fetch orders for this tenant
      const res = await fetch(`/api/orders?limit=500&sort=-createdAt`);
      if (!res.ok) throw new Error('Error al obtener pedidos');
      const data = await res.json();
      const docs = data.docs || [];
      setOrderCount(docs.length);

      if (docs.length === 0) {
        alert('No hay pedidos registrados para exportar.');
        return;
      }

      // Safe CSV Cell Sanitizer (prevent formula injection)
      const sanitize = (val: string | number | undefined | null) => {
        if (val === undefined || val === null) return '""';
        let str = String(val).trim();
        if (['=', '+', '-', '@'].some((p) => str.startsWith(p))) {
          str = `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };

      // Generate CSV
      const headers = [
        'Numero_Pedido',
        'Fecha',
        'Estado',
        'Cliente_Nombre',
        'Cliente_Telefono',
        'Cliente_Direccion',
        'Modalidad',
        'Metodo_Pago',
        'Referencia_Pago',
        'Subtotal_USD',
        'Tarifa_Delivery_USD',
        'Total_USD',
        'Tasa_VES',
        'Total_VES',
        'Moneda',
        'Items_Detalle',
        'Notas',
      ];

      const csvRows = [headers.join(',')];

      (docs as Order[]).forEach((o) => {
        const itemsStr = Array.isArray(o.items)
          ? o.items.map((i) => `${i.quantity}x ${i.title} ($${i.price})`).join(' | ')
          : '';

        const totalAmount = Number(o.totalAmount || 0);
        const rateVES = Number(o.exchangeRateVES || 0);
        const totalVES = rateVES > 0 ? totalAmount * rateVES : 0;
        const subtotal = Array.isArray(o.items) && o.items.length > 0
          ? o.items.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.quantity || 1)), 0)
          : totalAmount;
        const deliveryFee = Math.max(0, totalAmount - subtotal);

        const row = [
          sanitize(o.orderNumber || o.id),
          sanitize(o.createdAt ? new Date(o.createdAt).toLocaleString('es-VE') : ''),
          sanitize(o.status || 'pending'),
          sanitize(o.customer?.name),
          sanitize(o.customer?.phone),
          sanitize(o.customer?.address),
          sanitize(o.deliveryType || 'delivery'),
          sanitize(o.paymentDetails?.methodKey),
          sanitize(o.paymentDetails?.referenceNumber),
          sanitize(subtotal.toFixed(2)),
          sanitize(deliveryFee.toFixed(2)),
          sanitize(totalAmount.toFixed(2)),
          sanitize(rateVES.toFixed(2)),
          sanitize(totalVES.toFixed(2)),
          sanitize(o.currency || 'USD'),
          sanitize(itemsStr),
          sanitize(o.customer?.notes),
        ];
        csvRows.push(row.join(','));
      });

      const csvBlob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(csvBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `pedidos_${tenantSlug || 'tienda'}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      alert(`Error al exportar: ${msg}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="w-full mb-6 border border-zinc-800 bg-black text-zinc-100 p-4 shadow-2xl font-sans rounded-none isolate">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0 rounded-none">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>Gestión y Exportación de Pedidos</span>
              <span className="text-[10px] font-mono bg-zinc-900 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-none">
                Google Sheets / CSV
              </span>
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Descarga todos los pedidos de la tienda en formato compatible con Google Sheets y Excel en 1 clic.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://docs.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-400 hover:text-white transition inline-flex items-center gap-1 font-mono border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 rounded-none"
          >
            <span>Google Sheets</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>
        </div>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <span>Tienda activa: <strong className="text-white font-bold">/{tenantSlug}</strong></span>
          {orderCount !== null && (
            <span className="text-zinc-500">• {orderCount} pedidos exportados</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-mono font-semibold transition inline-flex items-center gap-1.5 rounded-none cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refrescar</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={exporting}
            className="px-4 py-2 bg-white hover:bg-zinc-200 active:bg-zinc-300 disabled:bg-zinc-800 disabled:text-zinc-500 text-black text-xs font-bold transition inline-flex items-center gap-2 shadow-lg whitespace-nowrap cursor-pointer rounded-none uppercase tracking-wider font-sans"
          >
            <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-bounce' : ''}`} />
            <span>{exporting ? 'Exportando...' : 'Descargar para Google Sheets'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

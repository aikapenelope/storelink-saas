import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Plus, ClipboardList, ShoppingBag, ExternalLink } from 'lucide-react';

/**
 * PR 2/5 (plan Analytics+CRM shadcn): hero del dashboard.
 * Feature-parity con la sección 2 del AnalyticsView original: título del
 * tenant, tasa activa con etiqueta de fuente y CTAs (tienda/productos).
 */
export interface HeroPanelProps {
  tenantName: string;
  dateTitle: string;
  rateVES: number | null;
  rateSource: 'manual' | 'binance' | 'paralelo' | 'none';
  tenantSlug: string;
  storeUrl: string;
}

const RATE_SOURCE_LABEL: Record<HeroPanelProps['rateSource'], string | null> = {
  manual: '(Personalizada)',
  binance: '(Binance P2P en vivo)',
  paralelo: '(Dólar paralelo)',
  none: null,
};

export function HeroPanel({ tenantName, dateTitle, rateVES, rateSource, tenantSlug, storeUrl }: HeroPanelProps) {
  return (
    <Card className="rounded-none border-border bg-card p-5 shadow-2xl">
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <span className="inline-block size-2 bg-foreground"></span>
            <span>Operación en línea · {dateTitle}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{tenantName}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Panel de ventas, gestión de pedidos y control de inventario
            <span className="mx-2 opacity-40">•</span>
            Tasa Activa:{' '}
            <span className="font-mono font-bold text-foreground">
              {rateVES ? `Bs. ${rateVES.toFixed(2)} / $` : '— (sin tasa)'}
            </span>
            {RATE_SOURCE_LABEL[rateSource] ? (
              <span className="ml-1.5 rounded-none border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {RATE_SOURCE_LABEL[rateSource]}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/collections/products/create"
            className="inline-flex items-center gap-1.5 rounded-none border border-border bg-muted px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-foreground transition hover:bg-accent"
          >
            <Plus className="size-3.5 shrink-0" />
            <span>+ Agregar Producto</span>
          </Link>
          <Link
            href="/admin/collections/orders"
            className="inline-flex items-center gap-1.5 rounded-none border border-border bg-muted px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-foreground transition hover:bg-accent"
          >
            <ClipboardList className="size-3.5 shrink-0" />
            <span>Ver en Payload</span>
          </Link>
          {tenantSlug ? (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-none bg-foreground px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-background shadow-lg transition hover:opacity-90"
            >
              <ShoppingBag className="size-3.5 shrink-0" />
              <span>Abrir Tienda</span>
              <ExternalLink className="size-3.5 shrink-0" />
            </a>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

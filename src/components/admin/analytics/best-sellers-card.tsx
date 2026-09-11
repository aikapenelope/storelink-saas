import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import type { BestSeller } from '@/lib/analytics';

/**
 * PR 2/5 (plan Analytics+CRM shadcn): top 5 más vendidos.
 * Feature-parity con la sección 7 del AnalyticsView original (mismo
 * ranking SQL de 30 días, mismas barras de progreso) con clases semánticas.
 */
export function BestSellersCard({ bestSellers }: { bestSellers: BestSeller[] }) {
  const maxUnits = Math.max(...bestSellers.map((p) => p.units), 1);

  return (
    <Card className="rounded-none border-border bg-card p-4 shadow-xl">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Catálogo
          </p>
          <h2 className="text-base font-bold text-foreground">Más vendidos</h2>
        </div>
        <Link
          href="/admin/collections/products"
          className="font-mono text-xs text-muted-foreground transition hover:text-foreground"
        >
          Ver catálogo →
        </Link>
      </div>

      <div className="space-y-3">
        {bestSellers.length > 0 ? (
          bestSellers.map((p, idx) => {
            const barPercent = Math.max(Math.round((p.units / maxUnits) * 100), 15);
            return (
              <div key={p.sku || p.title} className="flex items-center gap-3">
                <span className="w-5 font-mono text-xs font-bold text-muted-foreground">
                  0{idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">{p.title}</p>
                  <div className="mt-1 h-1 overflow-hidden bg-muted">
                    <div className="h-full bg-foreground" style={{ width: `${barPercent}%` }}></div>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground">
                  {p.units} uds
                </span>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center font-mono text-xs text-muted-foreground">
            <p>Se calcularán automáticamente con tus ventas.</p>
          </div>
        )}
      </div>
    </Card>
  );
}

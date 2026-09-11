import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TriangleAlert } from 'lucide-react';
import type { Product } from '@/payload-types';

/**
 * PR 2/5 (plan Analytics+CRM shadcn): alerta de inventario crítico.
 * Feature-parity con la sección 5 del AnalyticsView original: mismos chips
 * clicables al documento del producto en el admin. Clases semánticas para
 * modo claro/oscuro; en móvil los chips fluyen (flex-wrap).
 */
export function LowStockAlert({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <section>
      <Card className="flex-col gap-0 rounded-none border-border bg-card p-3.5 shadow-xl md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-foreground">
            <TriangleAlert className="size-4" />
          </div>
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
              Alerta de inventario: {products.length} productos con stock crítico
            </p>
            <p className="text-xs text-muted-foreground">
              Reabastece pronto para evitar ventas perdidas.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 md:mt-0">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/admin/collections/products/${p.id}`}
              className="flex items-center gap-1.5 rounded-none border border-border bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
            >
              <span>{p.title}</span>
              <b className="text-foreground">
                {p.stockQuantity !== undefined && p.stockQuantity !== null
                  ? `${p.stockQuantity} uds`
                  : 'Agotado'}
              </b>
            </Link>
          ))}
        </div>
      </Card>
    </section>
  );
}

/** Sugerencia: el Badge de shadcn queda disponible para los estados de stock
 *  del CRM (PR 4); LowStockAlert usa Link-chips para preservar la UI actual. */
export const _unusedBadge = Badge;

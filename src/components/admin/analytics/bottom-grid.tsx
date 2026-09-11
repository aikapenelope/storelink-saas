import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Send, FileSpreadsheet } from 'lucide-react';
import { GoogleSheetsSyncWidget } from '@/components/admin/GoogleSheetsSyncWidget';
import { buildVenezuelanWaUrl } from '@/lib/wa-url';

/**
 * PR 2/5 (plan Analytics+CRM shadcn): fila inferior — Mini CRM + Sheets.
 * Feature-parity con la sección 8 del AnalyticsView original. El helper
 * buildVenezuelanWaUrl reemplaza el patrón 58-prepend inline (unifica
 * encoding con el resto del sistema).
 */
export interface CustomerRow {
  id: number | string;
  name: string | null;
  phone: string | null;
  computedOrders: number;
  computedTier: 'vip' | 'recurrente' | 'nuevo';
}

export function BottomGrid({
  customers,
  tenantName,
  tenantSlug,
}: {
  customers: CustomerRow[];
  tenantName: string;
  tenantSlug: string;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
      {/* Mini CRM */}
      <Card className="rounded-none border-border bg-card p-4 shadow-xl">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Mini CRM
            </p>
            <h2 className="text-base font-bold text-foreground">Clientes frecuentes</h2>
          </div>
          <Link
            href="/admin/collections/customers"
            className="font-mono text-xs text-muted-foreground transition hover:text-foreground"
          >
            Abrir CRM →
          </Link>
        </div>

        <div className="space-y-1">
          {customers.slice(0, 4).map((c) => {
            const customerName = c.name || 'Cliente';
            const initials = customerName
              .split(' ')
              .map((n: string) => n.charAt(0))
              .join('')
              .toUpperCase()
              .slice(0, 2);
            const msg = `¡Hola ${customerName}! Te escribimos de ${tenantName}. ¿Cómo estás?`;
            const waUrl = c.phone ? buildVenezuelanWaUrl(c.phone, msg) : null;

            return (
              <div
                key={c.id}
                className="flex items-center gap-3 border-b py-2.5 last:border-0"
              >
                <span className="flex size-7 shrink-0 items-center justify-center bg-foreground font-mono text-xs font-extrabold text-background">
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">{customerName}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {c.computedOrders} pedidos ·{' '}
                    <span className="font-bold text-foreground">
                      {c.computedTier === 'vip'
                        ? 'VIP'
                        : c.computedTier === 'recurrente'
                          ? 'Recurrente'
                          : 'Nuevo'}
                    </span>
                  </p>
                </div>
                {waUrl ? (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-none border border-border bg-muted px-2.5 py-1 font-mono text-xs text-foreground transition hover:bg-accent"
                  >
                    <Send className="size-3 shrink-0" />
                    <span>WhatsApp</span>
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Google Sheets Widget */}
      <Card className="rounded-none border-border bg-card p-4 shadow-xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Sincronización de Catálogo
            </p>
            <h2 className="text-base font-bold text-foreground">Google Sheets en Vivo</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Actualiza tu catálogo pegando tu enlace de Google Sheets.
            </p>
          </div>
          <FileSpreadsheet className="size-5 shrink-0 text-foreground" />
        </div>
        <div className="mt-3">
          <GoogleSheetsSyncWidget tenantSlug={tenantSlug} tenantName={tenantName} />
        </div>
      </Card>
    </section>
  );
}

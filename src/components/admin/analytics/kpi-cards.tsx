import React from 'react';
import { Card } from '@/components/ui/card';
import { Wallet, ShoppingCart, Users, Package } from 'lucide-react';

/**
 * PR 2/5 (plan Analytics+CRM shadcn): fila de 4 KPI cards.
 * Feature-parity con las cards de AnalyticsView original — misma data, misma
 * jerarquía; clases semánticas (bg-card/text-foreground) para modo claro/oscuro.
 * Mobile: grid 1col → 2col (sm) → 4col (lg).
 */
export interface KpiCardsProps {
  todaySalesUSD: number;
  todaySalesVES: number;
  todayOrdersCount: number;
  totalSalesUSD: number;
  totalSalesVES: number;
  totalOrders: number;
  customerCount: number;
  vipCount: number;
  recurrenteCount: number;
  pendingOrdersCount: number;
  totalProducts: number;
  rateVES: number | null;
}

function KpiIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-foreground">
      {children}
    </div>
  );
}

function KpiFoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-center justify-between border-t pt-2.5">
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-none border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </span>
  );
}

function CardShell({
  label,
  value,
  icon,
  children,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 rounded-none border-border bg-card p-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <KpiIcon>{icon}</KpiIcon>
      </div>
      <KpiFoot>{children}</KpiFoot>
    </Card>
  );
}

export function KpiCards(props: KpiCardsProps) {
  const ves = (v: number) =>
    props.rateVES ? v.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : null;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <CardShell
        label="Ventas de hoy"
        value={`$${props.todaySalesUSD.toFixed(2)}`}
        icon={<Wallet className="size-4" />}
      >
        {props.rateVES ? (
          <span className="font-mono text-xs text-muted-foreground">Bs. {ves(props.todaySalesVES)}</span>
        ) : (
          <span />
        )}
        <Chip>{props.todayOrdersCount} hoy</Chip>
      </CardShell>

      <CardShell
        label="Ventas totales"
        value={`$${props.totalSalesUSD.toFixed(2)}`}
        icon={<ShoppingCart className="size-4" />}
      >
        {props.rateVES ? (
          <span className="font-mono text-xs text-muted-foreground">Bs. {ves(props.totalSalesVES)}</span>
        ) : (
          <span />
        )}
        <Chip>{props.totalOrders} pedidos</Chip>
      </CardShell>

      <CardShell
        label="Clientes CRM"
        value={String(props.customerCount)}
        icon={<Users className="size-4" />}
      >
        <span className="font-mono text-xs text-muted-foreground">
          {props.vipCount} VIP · {props.recurrenteCount} recurrentes
        </span>
        <Chip>Activos</Chip>
      </CardShell>

      <CardShell
        label="Por despachar"
        value={String(props.pendingOrdersCount)}
        icon={<Package className="size-4" />}
      >
        <span className="font-mono text-xs text-muted-foreground">{props.totalProducts} productos en BD</span>
        <Chip>{props.pendingOrdersCount > 0 ? 'En curso' : 'Al día'}</Chip>
      </CardShell>
    </section>
  );
}

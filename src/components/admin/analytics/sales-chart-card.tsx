'use client';

import React from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SalesDay } from '@/lib/analytics';

/**
 * PR 2/5 (plan Analytics+CRM shadcn): gráfico de ventas.
 * Reemplaza las barras custom de divs del AnalyticsView original:
 * misma serie (America/Caracas, mismo SQL), pero con tooltips táctiles,
 * selector de período (patrón dashboard-01: ToggleGroup ≥md / Select móvil)
 * y colores por tokens (legibles en modo claro y oscuro).
 * El servidor entrega series de 30 días; 7/14/30 se recortan en cliente.
 */
export interface SalesChartCardProps {
  series30: SalesDay[];
  totalSalesUSD: number;
  totalOrders: number;
}

const chartConfig = {
  amount: { label: 'Ventas ($)', color: 'var(--foreground)' },
  count: { label: 'Pedidos', color: 'var(--muted-foreground)' },
} satisfies ChartConfig;

const PERIODS = { '7d': 7, '14d': 14, '30d': 30 } as const;
type PeriodKey = keyof typeof PERIODS;

export function SalesChartCard({ series30, totalSalesUSD, totalOrders }: SalesChartCardProps) {
  const [period, setPeriod] = React.useState<PeriodKey>('7d');
  const days = PERIODS[period];
  const data = series30.slice(-days);

  const currentTotal = data.reduce((acc, d) => acc + d.amount, 0);
  const prev = series30.slice(-days * 2, -days);
  const prevTotal = prev.reduce((acc, d) => acc + d.amount, 0);
  const changePct = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : null;

  return (
    <Card className="rounded-none border-border bg-card p-4 shadow-xl">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Rendimiento · últimos {days} días
          </p>
          <h2 className="text-base font-bold text-foreground">Ventas y pedidos</h2>
        </div>
        <Link
          href="/admin/collections/orders"
          className="font-mono text-xs text-muted-foreground transition hover:text-foreground"
        >
          Ver reporte →
        </Link>
      </div>

      {/* Selector de período desktop: segmented control nativo (el ToggleGroup
          de Base UI tipa value como array; el original usaba botones sueltos). */}
      <div className="mb-2 hidden justify-end md:flex">
        <div className="flex rounded-none border border-border bg-card p-0.5">
          {Object.keys(PERIODS).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPeriod(k as PeriodKey)}
              aria-pressed={period === k}
              className={`rounded-none px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider transition ${
                period === k
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      {/* Selector móvil: Select de shadcn (Base UI Root tipa Value=string[] por
          defecto; el mini-wrapper fija el genérico a string). */}
      <div className="mb-2 flex justify-end md:hidden">
        {(() => {
          const TypedSelect = (Select as unknown as React.FC<{
            value?: string | null;
            onValueChange?: (v: string | null) => void;
            children?: React.ReactNode;
          }>);
          return (
            <TypedSelect value={period} onValueChange={(v) => v && setPeriod(v as PeriodKey)}>
              <SelectTrigger
                aria-label="Seleccionar período"
                size="sm"
                className="w-28 rounded-none border-border bg-card font-mono text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                {Object.keys(PERIODS).map((k) => (
                  <SelectItem key={k} value={k} className="rounded-none font-mono text-xs">
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </TypedSelect>
          );
        })()}
      </div>

      <ChartContainer config={chartConfig} className="h-48 w-full">
        <BarChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontFamily: 'var(--font-sans)' }}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                indicator="dot"
                labelFormatter={(_, payload) => {
                  const d = payload?.[0]?.payload as SalesDay | undefined;
                  return `${d?.dateStr ?? ''} · ${d?.count ?? 0} pedido(s)`;
                }}
                formatter={(value) => `$${Number(value).toFixed(2)}`}
              />
            }
          />
          <Bar dataKey="amount" fill="var(--color-amount)" radius={0} maxBarSize={28} />
        </BarChart>
      </ChartContainer>

      <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 bg-foreground"></span>
          <strong className="font-semibold text-foreground">Ventas ${totalSalesUSD.toFixed(0)}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 bg-muted-foreground/40"></span>
          <strong className="text-muted-foreground">Pedidos {totalOrders}</strong>
        </span>
        <span className="ml-auto flex items-center gap-1 font-bold text-foreground">
          {changePct !== null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%` : '—'}
          <TrendingUp className="inline size-3.5" />
        </span>
      </div>
    </Card>
  );
}

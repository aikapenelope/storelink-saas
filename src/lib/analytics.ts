import type { Payload } from 'payload';
import { sql } from '@payloadcms/db-postgres/drizzle';

/**
 * Agregaciones SQL para el dashboard de analíticas, patrón oficial de
 * Payload: payload.db.drizzle + re-exports de @payloadcms/db-postgres/drizzle
 * (https://payloadcms.com/docs/database/postgres#access-to-drizzle).
 * Todas las fechas se agrupan SIEMPRE en America/Caracas (UTC-4, sin DST).
 */

const TZ = 'America/Caracas';

export type OrderKpis = {
  orderCount: number;
  totalUSD: number;
  todayOrderCount: number;
  todayUSD: number;
  pendingCount: number;
  customerCount: number;
};

export type SalesDay = {
  dateStr: string;
  label: string;
  amount: number;
  count: number;
};

export type BestSeller = {
  sku: string;
  title: string;
  units: number;
  revenue: number;
};

function tenantClause(tenantId?: number | string | null) {
  return tenantId != null ? sql`AND tenant_id = (${tenantId})::int` : sql``;
}

const num = (v: unknown): number => Number(v) || 0;

export async function getOrderKpis(
  payload: Payload,
  tenantId?: number | string | null
): Promise<OrderKpis> {
  const t = tenantClause(tenantId);

  const [totalsRes, todayRes, pendingRes, customersRes] = await Promise.all([
    payload.db.drizzle.execute(sql`
      SELECT COUNT(*)::int AS count, COALESCE(SUM(total_amount), 0)::float8 AS total
      FROM orders
      WHERE (status != 'cancelled' OR status IS NULL) ${t}
    `),
    payload.db.drizzle.execute(sql`
      SELECT COUNT(*)::int AS count, COALESCE(SUM(total_amount), 0)::float8 AS total
      FROM orders
      WHERE (status != 'cancelled' OR status IS NULL)
        AND created_at >= date_trunc('day', now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ} ${t}
    `),
    payload.db.drizzle.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM orders
      WHERE (status IN ('pending', 'preparing', 'in_delivery') OR status IS NULL) ${t}
    `),
    payload.db.drizzle.execute(sql`
      SELECT COUNT(*)::int AS count FROM customers WHERE 1=1 ${t}
    `),
  ]);

  return {
    orderCount: num(totalsRes.rows[0]?.count),
    totalUSD: num(totalsRes.rows[0]?.total),
    todayOrderCount: num(todayRes.rows[0]?.count),
    todayUSD: num(todayRes.rows[0]?.total),
    pendingCount: num(pendingRes.rows[0]?.count),
    customerCount: num(customersRes.rows[0]?.count),
  };
}

function caracasDateStr(offsetDays: number): string {
  const date = new Date(Date.now() - offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return parts;
}

function caracasWeekdayLabel(offsetDays: number): string {
  const date = new Date(Date.now() - offsetDays * 86400000);
  const label = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, weekday: 'short' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1, 3);
}

export async function getSalesSeries(
  payload: Payload,
  tenantId?: number | string | null,
  days = 7
): Promise<SalesDay[]> {
  const t = tenantClause(tenantId);

  const res = await payload.db.drizzle.execute(sql`
    SELECT to_char((created_at AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS d,
           COUNT(*)::int AS count,
           COALESCE(SUM(total_amount), 0)::float8 AS total
    FROM orders
    WHERE (status != 'cancelled' OR status IS NULL)
      AND created_at >= (now() AT TIME ZONE ${TZ})::date::timestamp AT TIME ZONE ${TZ} - make_interval(days => (${days})::int) ${t}
    GROUP BY 1
    ORDER BY d ASC
  `);

  const byDate = new Map<string, { count: number; total: number }>();
  for (const row of res.rows) {
    byDate.set(String(row.d), { count: num(row.count), total: num(row.total) });
  }

  const series: SalesDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = caracasDateStr(i);
    const day = byDate.get(dateStr) ?? { count: 0, total: 0 };
    series.push({
      dateStr,
      label: caracasWeekdayLabel(i),
      amount: day.total,
      count: day.count,
    });
  }
  return series;
}

export async function getBestSellers(
  payload: Payload,
  tenantId?: number | string | null,
  limit = 5,
  // M5 (plan v2): ventana acotada a 30 días — el ranking refleja el negocio
  // RECENTE y el filtro usa orders_tenant_created_idx en lugar de escanear
  // todo el histórico.
  days = 30
): Promise<BestSeller[]> {
  const tenantFilter = tenantId != null ? sql`AND o.tenant_id = (${tenantId})::int` : sql``;

  const res = await payload.db.drizzle.execute(sql`
    SELECT i.sku, i.title, SUM(i.quantity)::int AS units, COALESCE(SUM(i.subtotal), 0)::float8 AS revenue
    FROM orders_items i
    JOIN orders o ON o.id = i._parent_id
    WHERE (o.status != 'cancelled' OR o.status IS NULL)
      AND o.created_at >= (now() AT TIME ZONE ${TZ})::date::timestamp AT TIME ZONE ${TZ} - make_interval(days => (${days})::int) ${tenantFilter}
    GROUP BY i.sku, i.title
    ORDER BY units DESC
    LIMIT (${limit})::int
  `);

  return res.rows.map((row) => ({
    sku: String(row.sku ?? ''),
    title: String(row.title ?? 'Producto'),
    units: num(row.units),
    revenue: num(row.revenue),
  }));
}
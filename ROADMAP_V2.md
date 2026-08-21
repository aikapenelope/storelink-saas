# 🗺️ Roadmap V2 — Escala 100–200 Tiendas

> Documento de ingeniería derivado de la auditoría de seguridad y rendimiento (Ago 2026).
> Los ítems críticos de **seguridad** ya están resueltos en la rama `fix/security-audit-payload-official`.
> Este roadmap agrupa lo necesario para que la plataforma aguante 100–200 comercios concurrentes
> sin degradar latencia, agotar cuotas de serverless ni saturar Supabase.

---

## 1. 🚄 Caché y renderizado del storefront (prioridad ALTA)

**Hoy:** todas las páginas de tienda usan `export const dynamic = 'force-dynamic'`. Cada visita ejecuta
3+ queries a Supabase + fetch a Binance/dolarAPI dentro del request. Con tráfico real el pool
(`max: 10` conexiones) se satura primero, y después la factura de cómputo de Vercel.

**Plan:**
- Migrar storefront a **ISR con revalidación por tag**: `export const revalidate = 300` +
  `revalidateTag('tenant-<slug>')` desde los puntos de mutación (checkout, sync-sheets,
  exchange-rate). Patrón oficial de Next.js 15 App Router compatible con Payload Local API.
- La tasa de cambio NO debe resolverse en el request path: moverla a un route handler cacheado
  (`/api/rates`, `revalidate: 300`) o a un cron de Vercel que escriba la tasa en el tenant.
- Considerar `unstable_cache` de Next para el bloque de productos (TTL corto) manteniendo el
  carrito 100% client-side.

## 2. 📦 Imports batch (Google Sheets / CSV) (prioridad ALTA)

**Hoy:** el sync hace ~3 round-trips SQL por fila (find categoría + find producto + create/update),
secuenciales. Un catálogo de 500 productos ≈ 1.500 queries → timeout de la función serverless.

**Plan:**
- Cargar todo el CSV en memoria y hacer **diff local** (Map por SKU) antes de tocar la DB.
- Crear categorías en lote; usar `payload.db.drizzle.insert(...).onConflictDoUpdate()` o chunks de
  `payload.create` con `req: { transactionID }` compartido para atomicidad por lote.
- Procesar archivos grandes (>200 filas) en background: Vercel Queues / cron chunked, respondiendo
  `202 Accepted` + polling de estado.
- Índice compuesto `products(tenant_id, sku)` — hoy solo existen índices individuales.

## 3. 📊 Analíticas sin cargar la DB en memoria (prioridad MEDIA)

**Hoy:** `AnalyticsView` y `MerchantDashboard` traen hasta 300 órdenes completas a JS y suman en
memoria. Con 200 tiendas × cientos de pedidos/día esto es O(órdenes) por cada carga del panel.

**Plan:**
- Reemplazar por agregación SQL directa vía `payload.db.drizzle`
  (`SELECT tenant_id, status, SUM(total_amount), COUNT(*) ... GROUP BY`) o por una colección
  `daily-metrics` llenada por cron nocturno (patrón rollup).
- Paginar real en la lista de pedidos del dashboard (hoy `limit: 500` fijo).

## 4. 🛡️ Rate-limiting y abuso del checkout (prioridad ALTA)

**Hoy:** `processOrder` es una Server Action pública sin rate limit, captcha ni honeypot. Cada spam
crea orden en DB + tarjeta Trello + correo Resend + PDF.

**Plan:**
- Rate limit por IP+tenant con Upstash Redis (@upstash/ratelimit) o Vercel WAF en producción:
  p.ej. 5 checkouts/min/IP.
- Honeypot + verificación de tiempo mínimo de formulario (anti-bot sin fricción).
- Firmar el payload del checkout con un nonce emitido al renderizar la tienda (expira en 30 min).

## 5. 🔁 Cola de integraciones salientes (prioridad MEDIA)

**Hoy:** Trello/Resend se llaman inline durante el checkout; si Trello tarda 8s, el cliente espera 8s.
Una caída de Resend no debe romper el flujo del pedido.

**Plan:**
- Persistir la orden primero (con `trelloDispatched: false`), y despachar Trello/email en un paso
  asíncrono (cron cada minuto procesando pendientes, o Inngest/QStash).
- Reintentos exponenciales + alerta al super-admin cuando una orden quede >15 min sin despachar.

## 6. 🗃️ Base de datos (prioridad MEDIA)

- **Pool:** mantener Transaction Pooler 6543 con `max: 10`; revisar `pgBouncer` mode=transaction
  (ya default en Supabase pooler). Para picos, subir réplicas de lectura en Supabase Pro.
- **SSL:** evaluar certificado CA real para quitar `rejectUnauthorized: false` (MITM teórico hoy).
- **Backups:** activar PITR diario de Supabase y probar restore trimestral.
- **Media:** R2 ya está conectado (verificado en Vercel CLI Ago 2026: R2_BUCKET/ENDPOINT/PUBLIC_URL).
  Añadir lifecycle rules de R2 para thumbnails huérfanos tras borrado de productos.

## 7. 🧾 Números de pedido y conciliación (prioridad BAJA — ya parcialmente resuelto)

- ✅ Hecho en esta rama: `orderNumber` único + snapshot `exchangeRateVES` por pedido.
- V2: secuencia por tenant (`TIENDA-000123`) legible para el comerciante, generada con
  `SELECT ... FOR UPDATE` sobre un contador por tenant.

## 8. 📈 Observabilidad (prioridad MEDIA)

- Sentry (frontend+server) con release de Vercel.
- Log drain de Vercel → Axiom/Datadog; alertas de error rate >1%.
- Uptime checks por tienda (ping `/[slug]` cada 5 min desde Better Stack) — SLA comercial.

## 9. 🔐 Endurecimiento continuo

- Rotar la API key de Resend filtrada en el historial git (hecho en Vercel; confirmar revocación
  en dashboard de Resend) y purgar historia si el repo se hace público algún día.
- `dependabot.yml` + `pnpm audit --prod` en CI.
- Migrar `graphql@17` → `^16.8.1` (peer requirement oficial de Payload 3.x) cuando se toque package.json.
- 2FA obligatorio para super-admins (Payload soporta auth custom; plugin community para TOTP).

---

### Criterio de "listo para 200 tiendas"

| Métrica | Objetivo |
|---|---|
| TTFB storefront p95 | < 400 ms (cacheado) |
| Checkout completo p95 | < 2.5 s |
| Queries por pageview tienda | ≤ 1 (cache hit) |
| Import 1.000 productos | < 60 s, sin timeout |
| Error rate global | < 0.5% |
| Coste infra mensual | < $80 (Vercel Pro + Supabase Pro + R2 free) |

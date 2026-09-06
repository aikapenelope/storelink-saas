# Go-Live Sprint 4 — Límites publicables, operación y pendientes del dueño

**Fecha:** 2026-09-06 · **Base:** auditoría 2026-09-05 (`AUDITORIA_FINAL_2026-09-05.md`, en PR #84) + verificaciones en vivo del Sprint 4.
**Qué es:** cierre operacional del plan post-auditoría. Cada límite con su mecanismo verificable, la decisión de planes para los tenants actuales, los hallazgos operacionales medidos en producción y la checklist exacta de lo que solo el dueño puede confirmar.

---

## 1. Estado de verificación (2026-09-06)

**Verificado con evidencia:**
- Supabase (`storelink-db`): 2 tenants reales — `don-luigi` (0 productos) y `aurita` (99 productos), ambos **sin plan → estándar 1000**. 22 migraciones registradas, sin drift. Columna `plan` aplicada (batch 11, PR #84).
- Runner de jobs (`jobs-runner.yml`): **activo y en verde** (últimas 12 ejecuciones `success`). Incluye el healthcheck `jobs-health` que falla el run → email de GitHub si hay jobs fallidos o un pendiente >30 min.
- Storefront producción: `/don-luigi` y `/aurita` → 200; `/api/e2e/seed` → 404 (guard fail-closed, PR #85).
- Suite de tests contra BD real: 151 passed / 4 skipped / **0 failed** (PR #86).

**Pendiente de dashboard (solo el dueño puede leerlo):** §7.

---

## 2. Límites publicables por tienda (tabla final)

| Dimensión | Límite publicable | Mecanismo que lo respalda | Si se supera |
|---|---|---|---|
| Productos por tienda | **Básico 500 · estándar 1000 · Pro 2000** | `lib/tenant-plans.ts` (fuente única) + `getCachedProducts` + puerta de cuota en import (PR #84) | Filas nuevas omitidas con `limitReached` en el job; re-sync de SKUs existentes nunca consume cupo |
| Filas por importación | **5.000 / 2 MB** | `lib/csv.ts` (MAX_CSV_ROWS/MAX_CSV_BYTES) | Rechazo 400 con mensaje |
| Ítems por pedido / cantidad por SKU | **30 líneas · 1–999 c/u** | `constants.ts` + `verifyAndPriceItems` server-side | Rechazo del checkout |
| Pedidos/min por IP+tienda | **5** (`RATE_LIMIT_CHECKOUT_PER_MIN`) · tenant 50/min | Upstash sliding window, fail-open decidido | 429; honeypot+nonce siguen activos |
| **Pedidos/día (plataforma, Upstash free)** | **≈2.000 (conservador)** | Upstash free = **500K comandos/mes** (upstash.com/pricing, consultado 2026-09-06). Baseline del storefront ~3-5K cmd/día + 2-3 cmd por checkout | Al agotar: **fail-open** — checkout continúa sin idempotencia/rate-limit (degradación documentada, no caída) |
| Emails de confirmación (clave master) | **100/día · 3.000/mes GLOBALES** (resend.com/pricing, consultado 2026-09-06) | 1 email por pedido | El job reintenta 3×; la orden NO se pierde (WhatsApp/Trello son los canales primarios). Al escalar: BYOK por tenant elimina el tope compartido |
| Notas de entrega (R2 free) | **~150.000 PDFs** · Class A 1M/mes · Class B 10M/mes (developers.cloudflare.com/r2/pricing, consultado 2026-09-06) | 1 PUT (~50 KB) por pedido; descargas solo vía URL firmada ≤7 días | Fallo de subida → PDF ausente, orden intacta |
| Funciones Vercel (Hobby) | default 10s–300s / **máx 300s**; **100 deploys/día** (vercel.com/docs/limits + /docs/plans/hobby, consultado 2026-09-06) | Timeouts R3 en todos los externos (Trello/Resend/tasa 5s) | El worst-case del checkout (~5s) cabe holgado |
| Cron Vercel | **No usado** — Hobby solo permite 1/día (docs oficiales) | Runner externo GitHub Actions (ver §4) | — |
| Visitantes concurrentes | ~50-100/tienda sin degradación | ISR 300s + caché Redis/memoria + pool DB max:10 | Degradación gradual de latencia; ISR sirve caché; sin error duro |
| BD (Supabase free) | **500 MB** — uso actual ~2 MB | Counts verificados 2026-09-06 | Aviso del provider; margen de años |

**Corrección vs el informe de auditoría:** el tope de Upstash es **500K comandos/mes** (no 10K/día como supuse) — el límite publicable de pedidos/día sube de ~5.000 a un conservador ~60.000/mes. La tabla de esta sección es la vigente.

---

## 3. Decisión de planes para los tenants actuales

| Tenant | Productos | Plan asignado | Acción |
|---|---:|---|---|
| don-luigi | 0 | *(ninguno — estándar 1000)* | Ninguna. Margen ∞ |
| aurita | 99 | *(ninguno — estándar 1000)* | Ninguna. Margen 10× |

**Decisión:** dejar ambos en estándar (sin tocar el admin). Los planes Básico/Pro se asignan cuando exista la razón comercial (onboarding de comercios nuevos o upsell); es un campo en `Tenants → Plan de Capacidad`, solo super-admin, efectivo inmediato sin deploy.

---

## 4. Hallazgo operacional: el runner de jobs corre con retrasos

- **Diseño:** cron `*/5 * * * *` (cada 5 min).
- **Medido (12 ejecuciones, 2026-09-04→06):** intervalos de **1,5 a 3,5 horas** entre runs. GitHub Actions throttlea los schedules en carga (comportamiento documentado por GitHub, sin SLA de precisión en free tier).
- **Impacto real:** NINGUNO en el happy path — el checkout y las importaciones ejecutan sus jobs al instante vía dual-dispatch (`after()` en la misma función). El runner es la **red de reintentos** para jobs interruidos a mitad (función cortada): hoy esa resiliencia tarda horas, no minutos. El healthcheck (`jobs-health`) también se ejecuta con esos retrasos.
- **Opciones:**
  - **(a) Aceptar documentado** — recomendado hoy: 0 costo, 0 cambios, riesgo acotado al caso raro de job interrumpido.
  - (b) Migrar el schedule a **QStash Schedules** (Upstash) con precisión de minutos (~costo mínimo) — PR pequeño si algún día los reintentos lentos duelen.
  - (c) GitHub Pro — no garantiza precisión de schedule; no recomendado como solución.

---

## 5. Comunicación de límites al comercio (template)

> Tu tienda Flow incluye hasta **1.000 productos** en catálogo (ampliable con plan Básico 500 / Pro 2.000 según lo que acuerdes con el equipo Flow). Puedes **re-sincronizar tu catálogo completo las veces que quieras** (actualiza precios, stock y fotos sin consumir cupo — el cupo solo aplica a productos NUEVOS). Otras cotas: 5.000 filas por archivo de importación, 6 fotos por producto, 30 ítems por pedido y un filtro anti-abuso de 5 pedidos por minuto por cliente. Si algo de esto se te queda corto, escríbenos por WhatsApp y lo ajustamos a tu operación.

---

## 6. Checklist final del dueño

1. **Mergear** PRs #84 (planes), #85 (seed previews + pentest), #86 (tests + hardening) y el PR de este documento.
2. **Confirmar cotas de uso real** (5 min, comparar contra §2):
   - Vercel → *Usage*: Fast Data Transfer, ejecuciones de función.
   - Upstash → *console*: comandos/día y uso mensual vs 500K.
   - Resend → *dashboard*: emails/día vs 100.
   - Cloudflare R2 → *metrics*: storage y operaciones vs free tier.
3. **Sprint 2 (evidencia dinámica):** Vercel → Settings → Deployment Protection (desactivar para previews o copiar el *Protection Bypass secret*) + definir `E2E_SEED_SECRET` en scope **Preview**. Con eso: `PENTEST_BASE_URL=... E2E_SEED_SECRET=... node scripts/pentest-cross-tenant.mjs`.
4. **Decidir** sobre el hallazgo del runner (§4): aceptar documentado o abrir el PR de QStash.

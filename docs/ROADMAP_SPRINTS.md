# Roadmap de Sprints — Remediación post-auditoría 2026-09-04

Derivado de `docs/AUDITORIA_INTEGRAL_2026-09-04.md` (5.8/10 NO-GO remediable → objetivo ≥8.0 GO).
Cada sprint = 2 semanas, 1–3 PRs, con criterios de aceptación verificables. El PR #73 (remediación
de la auditoría) cierra los fixes transversales; este roadmap organiza lo restante.

**Criterio de alcance (decisión del dueño, 2026-09-05):** entra lo que haga la plataforma
más ROBUSTA (que funcione, no se caiga, no corrompa datos, se pueda operar). Quedan FUERA los
ítems regulatorios/de-producto sin impacto en funcionamiento (derecho al olvido, aviso de
privacidad como feature, métricas de negocio) — quedan anotados al final como backlog opcional.

**Trayectoria de puntaje proyectada:**

| Sprint | Enfoque | Score proyectado |
|---|---|---|
| (PR #73 mergeado) | Fixes transversales de seguridad/correctitud/SEO | ~7.3 |
| Sprint 1 | Flujo de pedidos a prueba de balas + datos/PII | ~7.7 |
| Sprint 2 | Observabilidad y operación | ~8.0 |
| Sprint 3 | Deuda estructural I (cart-drawer) | ~8.2 |
| Sprint 4 | Deuda estructural II (checkout/Orders) | ~8.4 |
| Sprint 5 | Datos, performance y hardening | ~8.6 |
| Sprint 6 | Producto y decisiones pendientes | ~8.8 |

---

## Sprint 1 — Flujo de pedidos a prueba de balas + PII (semanas 1–2)

**Objetivo:** eliminar los P1 restantes que tocan dinero/PII directo.

### PR 1 de reparación (`sprint-1/pr1-reparacion`) — ESTE PR
| Ítem | Hallazgo | Detalle |
|---|---|---|
| Idempotencia de checkout | P1-2 | Clave SHA-256 (tenant+items+cliente) con `SET NX` en Upstash; reintento/doble-clic devuelve la respuesta del primer pedido en vez de duplicar la orden. Fail-open documentado (misma decisión que rate-limit). |
| Alertas de jobs | P1-13 (parcial) | `GET /api/admin/jobs-health` (cron-protected): fallidos>0 o job pendiente >30min → 503; `jobs-runner.yml` falla el step → email de GitHub. Cubre el riesgo de que el schedule de GitHub muera en silencio a los 60 días. |
| Roadmap de sprints | — | Este documento. |

**Aceptación:** tests unitarios de idempotencia (determinismo + fail-open); `pnpm build`/`lint`/
`tsc` verdes; suite de integración con Postgres real verde; CI verde.

### PR 2 — Baseline + índice único SKU (requiere owner con BD local)
| Ítem | Hallazgo | Detalle |
|---|---|---|
| Migración baseline | P1-24bis | Owner: `pnpm migrate:create` contra BD vacía local → registrar PRIMERO en `src/migrations/index.ts`. La suite de paridad pasa a modo completo automáticamente. |
| Índice único `(tenant_id, sku)` | P2-22 | Tras el baseline, `migrate:create` genera el índice + migración de dedupe previa (merge de SKUs duplicados: se conserva el más antiguo y se re-mapean orders). |
| E2E en CI | P2-26 | Job nocturno con el servicio Postgres ya definido: migraciones + `pnpm dev` + Playwright smoke de las 9 plantillas + admin. |

**Aceptación:** paridad en modo completo verde en CI; e2e nocturno verde 5 días seguidos.

### Acciones del owner en paralelo (no código)
1. **R2**: verificar que el bucket NO sirve `delivery-notes/` público (P1-15 — si está público, P0).
2. `SUPABASE_CA_CERT` en Vercel (P2-27). 3. `vars.PROD_BASE_URL` en GitHub. 4. Decidir REST
público del catálogo (P2-23). 5. Backups: drill de restauración de Supabase.

## Sprint 2 — Observabilidad y operación (semanas 3–4)

| Ítem | Hallazgo | PR |
|---|---|---|
| Error tracking | P1-13 | PR 3: `@sentry/nextjs` con `onRequestError` (robustez operacional: VER que un checkout falló en producción en vez de descubrirlo por un cliente). Sin DSN del owner queda no-op. Alternativa contrastada: log drain de Vercel a Better Stack. |
| Runbook de incidentes | Checklist ❌ | PR 4: `docs/RUNBOOK.md` (schema drift, Upstash caído, tasa congelada, colas atascadas, fuga de secretos) — reducir el tiempo de reparación cuando algo falle. |

**Aceptación:** un `throw` en preview llega a Sentry en <1min; runbook revisado y probado
(simulacro de Upstash caído).

## Sprint 3 — Deuda estructural I: `cart-drawer.tsx` (semanas 5–6)

Descomposición según auditoría §6 (bloques con rangos verificados). PRs pequeños y acumulables:

| PR | Extracción | Líneas origen |
|---|---|---|
| PR 5 | `src/lib/money.ts` (formatUSD/formatVES/toVES — única fuente; hoy 3 convenciones conviven) | utils + drawer |
| PR 6 | `cart/types.ts` + `cart/use-payment-methods.ts` + `cart/use-checkout.ts` | 28-103, 142-179, 225-357 |
| PR 7 | `cart/order-success.tsx` + `cart/cart-items.tsx` + `cart/delivery-form.tsx` | 394-437, 446-480, 499-623 |
| PR 8 | `cart/payment-method-button.tsx` + `cart/payment-account-card.tsx` (7×~20 líneas → 1 mapeado; 5 tarjetas → 1 genérico ~60 líneas) | 694-1185 |
| PR 9 | `cart/payment-verification-fields.tsx` + geo a `src/lib/venezuela-checkout.ts` | 1187-1401, 203/612-663/1204 |

**Aceptación:** drawer <300 líneas; cada módulo con test unitario de cálculo; smoke visual en
`/demo`; bundle del storefront sin crecimiento.

## Sprint 4 — Deuda estructural II: checkout/Orders/landing (semanas 7–8)

| PR | Extracción |
|---|---|
| PR 10 | `lib/checkout/validation.ts` + `lib/pricing/verify-items.ts` (pricing canónico de servidor) |
| PR 11 | `lib/whatsapp/message.ts` (hoy duplicado con trello.ts) + `lib/orders/order-number.ts` |
| PR 12 | `lib/crm/upsert.ts` + `lib/crm/delta.ts` (unifica dominio CRM hoy repartido entre checkout.ts y Orders.ts) |
| PR 13 | `lib/inventory/atomic-stock.ts` + `hooks/manage-order-inventory.ts` (Orders.ts → ~230 líneas) |
| PR 14 | Landing a Server Components real (secciones a `components/landing/*`, iconify → SVG inline) |

**Aceptación:** `pnpm test` completo verde tras cada PR; ningún cambio de comportamiento (diffs de refactor puro, verificados con e2e).

## Sprint 5 — Datos, performance y hardening (semanas 9–10)

| Ítem | Hallazgo | PR |
|---|---|---|
| Batch import de catálogo | P2-31 | PR 15: insert/update multi-row vía Drizzle en `catalog-import` + paginar prefetch dedupe (>5000). |
| Storefront `select` + truncado | P2-32 | PR 15: `select` explícito en `getTenantBySlug`/`getCachedProducts`; log + UI si `totalDocs > 500`. |
| Guard anti-pooler generalizado | P2-24 | PR 16: helper compartido importado por las 20 migraciones + política `prodMigrations` documentada. |
| CSP fase 2 | Riesgo aceptado | PR 16: quitar `unsafe-eval`, nonces para el admin; medir reportes antes de enforce. |
| Tarea VES y redondeo | P3-15 | PR 16: `numeric(12,2)` para totales (migración; requiere owner para `migrate:create`). |

## Sprint 6 — Producto y decisiones (semanas 11–12)

| Ítem | Hallazgo | Nota |
|---|---|---|
| Perfil regional por tenant | P1-14 | `checkoutLocale` en Tenants (país, prefijo, municipios default); migra las constantes geo de Sprint 3 a config. |
| 2FA | Decisión 2026-08-29 | Re-decidir con datos: TOTP plugin vs passkeys vs mantener lockout. |
| Rate limits con datos reales | Riesgo aceptado | Re-evaluar cotas y fail-open del checkout con tráfico real. |
| Nonce single-use | P1-2 residual | Solo si la idempotencia de Sprint 1 no bastó en la práctica. |
| Re-auditoría | — | Versión rápida (Fases 1/2/3/5) al cerrar Sprint 6; objetivo global ≥8.0 GO. |

---

**Reglas transversales (constitución):** cada PR rebasado sobre main, `pnpm build` 0 errores antes
de abrir, commits atómicos, migraciones solo con `migrate:create` (owner), nunca merge automático.
Stack de PRs permitido mientras #73 no esté mergeado (base = rama padre), rebasar al mergear.

---

## Backlog opcional (FUERA del roadmap por decisión del dueño)

Ítems regulatorios/de-producto sin impacto directo en el funcionamiento. Si algún día hacen
falta (clientes internacionales, exigencia legal), están especificados en el informe de
auditoría (§4, hallazgos 11/12 y §7):

- Derecho al olvido (anonimización de clientes + purga de delivery-notes >180d).
- Webhook de bounces de Resend.
- Métricas de negocio programáticas.

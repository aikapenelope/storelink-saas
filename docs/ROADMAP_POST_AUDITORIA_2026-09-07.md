# ROADMAP POST-AUDITORÍA 2026-09-07 — Plan detallado de 14 PRs

> ⚠️ **DOCUMENTO HISTÓRICO CONSOLIDADO (13/14 PRs MERGEADOS)**  
> 13 de los 14 PRs detallados en este plan ya fueron ejecutados, probados y mergeados en `main` (PRs #90 a #102).  
> El estado técnico consolidado y los pendientes vigentes se encuentran en la fuente única de verdad:  
> 🔗 [`docs/ESTADO_Y_ROADMAP_CONSOLIDADO.md`](ESTADO_Y_ROADMAP_CONSOLIDADO.md).

**Origen:** `docs/AUDITORIA_2026-09-07.md` (score 8,8 GO; cero P0/P1 producción). Cada PR sigue el formato spec-from-findings: problema con evidencia, patrón oficial aplicado, alcance, criterios de aceptación testeables, verificación y rollback.
**Reglas transversales (constitución):** un PR = un cambio lógico; si toca `src/collections/*` → migración `migrate:create` + `src/migrations/index.ts` + `pnpm generate:types` **en el mismo commit**; rebase contra `main` antes de abrir; build verde; NUNCA merge (lo hace el dueño); identidad `AngelDelN`.

---

## Contraste con patrones oficiales Payload 3.x (skill + Context7 `payloadcms/payload`)

| Patrón oficial | Estado en repo | Acción |
|---|---|---|
| `versions: { drafts: true }` por defecto | **Desviación documentada y aprobada** (colecciones transaccionales sin ciclo draft/publish; matriz §6 baseline) | No re-abrir |
| Native `slug` field type | **Desviación evaluada**: categories usa text + unicidad compuesta `(tenant_id,slug)` en BD | No re-abrir |
| Local API `user + overrideAccess:false` | ✅ Cumple en TODAS las rutas por-usuario (verificado hasta el código del plugin instalado) | Mantener |
| `req` en operaciones anidadas (atomicidad) | ✅ Cumple (hooks usan `req.transactionID`); CRM es best-effort FUERA de tx **a propósito** (documentado) | PR 2 preserva ese contrato |
| `req.context` anti-loops | ✅ Cumple (`skipRevalidate`, flags checkout) | Mantener |
| "Never trust client-provided data" | ⚠️ 3 fugas detectadas (PR 1, 3, 4) | Corregir |
| `min` + `validate` en number fields (Context7: fields/overview, number.mdx) | Falta en `orders.items.quantity` | PR 3 |
| `auth.useSessions` — revocación inmediata vía `sid` validado en BD (Context7: strategies/jwt.ts) | No usado (JWT puro, lag 7 días) | PR 9 opción A |
| `tokenExpiration` (authentication/overview) | 7 días | PR 9 opción B |
| Jobs Queue: task `schedule` (cron auto-queue) + `payload.jobs.run({ where })` (jobs-queue/queues.mdx) | No usado (runner externo único) | PR 6 |
| `deleteJobOnComplete` (fuente oficial: bulk-delete tras completar) | `true` global — destruye diagnósticos de import | PR 6 |

---

## PR 1 — `fix(checkout)`: paymentStatus y título server-authoritative
- **ID:** SPEC-20260907-1 · **Origen:** A1 + A2 (3C-P2-1, 3A-P2-1) · **Prioridad:** P2 (la más alta del plan) · **Esfuerzo:** S · **Riesgo:** Bajo · **Schema:** No
- **Problema:** el comprador puede enviarse `paymentStatus:'verified'` y la orden nace "pago verificado" (`checkout.ts:826` persiste `customer.paymentDetails` tal cual); el título del ítem también viaja del cliente y se persiste en orden/PDF/WhatsApp (`checkout.ts:276`, `itemsSummary` sin sanitizar `:474-476`).
- **Cambios:**
  1. Normalizar `paymentDetails` con whitelist de claves y forzar `paymentStatus: 'pending_verification'` server-side (ignorar SIEMPRE el valor del cliente).
  2. `title: matchedVariant?.name || dbProd.title` (nunca `item.title`).
  3. `itemsSummary` del CRM construido desde títulos del server + `sanitizePlainText`.
- **Patrón oficial:** "Never trust client-provided data" (skill Payload §Security); `sanitizePlainText` ya existe en `order-email.ts`.
- **AC:**
  - [ ] Submit con `paymentStatus:'verified'` forjado → orden guardada `pending_verification` (test unit).
  - [ ] Submit con `title:"iPhone 16 Pro"` para un producto real → orden/PDF/CRM llevan el título de BD (test unit).
  - [ ] Claves desconocidas en `paymentDetails` descartadas.
- **Verificación:** `pnpm build` + `pnpm test` + nuevos tests en `tests/unit/`.
- **Rollback:** revert (sin schema).

## PR 2 — `fix(crm,inventory)`: claim atómico de `crmCounted` + restauración con `previousDoc.items`
- **ID:** SPEC-20260907-2 · **Origen:** A3 + A4 (3B-P2-1/P2-2) · **Esfuerzo:** M · **Riesgo:** Bajo-Medio · **Schema:** No
- **Problema:** carrera TOCTOU: cancelación entre `crmCounted=true` y `findByID` resta 2 veces el CRM (`checkout.ts:916-943` + `Orders.ts:682-691`); cancelación con edición de ítems en el mismo save repone cantidades NUEVAS en vez de las deducidas (`Orders.ts:653-663`).
- **Cambios:**
  1. Reemplazar secuencia update→findByID por **claim atómico**: `UPDATE orders SET crm_counted = true WHERE id = $1 RETURNING status` (mismo patrón de executor drizzle que `applyBaseProductStockDelta`, tabla `orders` via `tableNameMap`) y compensar solo si el `status` devuelto por ESA fila es `cancelled`.
  2. En el hook de cancelación: `restoreStockForItems({ items: previousDoc?.items ?? doc.items, ... })`.
- **Patrón oficial:** SQL por adapter oficial (drizzle) dentro del patrón de repo existente; el CRM sigue best-effort FUERA de la tx (contrato documentado, no se rompe).
- **AC:**
  - [ ] Test de integración: cancelar la orden entre el claim y la compensación resta exactamente 1 vez (simulable con estado inicial `cancelled`).
  - [ ] Save con edición 2→5 + status→cancelled restaura 2 (no 5).
  - [ ] Tests existentes de `order-checkout-lifecycle` siguen verdes.
- **Rollback:** revert (sin schema).

## PR 3 — `fix(catalog)`: validación de `quantity` + determinismo de SKUs
- **ID:** SPEC-20260907-3 · **Origen:** A5 + C4 (3B) · **Esfuerzo:** S · **Riesgo:** Bajo · **Schema:** No
- **Problema:** `orders.items.quantity` sin `min` a nivel colección → `quantity:-5` por admin/REST **aumenta** stock (`Orders.ts:964-969`); `products.sku` no es único por tenant → pricing/stock resuelven el primero del find sin `sort` (`checkout.ts:189-194`, `Orders.ts:277-282`).
- **Cambios:**
  1. Campo quantity: `min: 1` + `validate: (v) => Number.isInteger(v) || 'Debe ser un entero'` — **patrón oficial de validación de campo** (corre en REST y admin, no requiere migración).
  2. `sort: 'id'` en las 2 queries del índice de productos por SKU.
  3. Validación por hook en `Products.ts` (beforeChange): rechazar SKU duplicado dentro del mismo tenant (incluye variantes).
- **Fuera de alcance (follow-up):** índice UNIQUE parcial en BD `(tenant_id, sku)` — requiere scan de duplicados previo (expand/contract). Documentado como PR futuro.
- **AC:**
  - [ ] REST create de orden con `quantity:-5` → error de validación de Payload.
  - [ ] Crear 2 productos con mismo SKU y mismo tenant → el segundo rechaza.
  - [ ] `pnpm generate:types` al día (cambio de campo).
- **Rollback:** revert (sin schema).

## PR 4 — `fix(checkout)`: PDF/R2 tras crear la orden + whitelists de entrada
- **ID:** SPEC-20260907-4 · **Origen:** A6 (3A-P2-2) · **Esfuerzo:** M · **Riesgo:** Medio · **Schema:** No
- **Problema:** el PDF se genera y sube a R2 ANTES de `payload.create` (`checkout.ts:764-794` vs `:817`): una validación provocable (ej. `deliveryType` arbitrario) quema cuota R2 y deja PDFs huérfanos.
- **Cambios:**
  1. En `validateCheckoutInput`: `deliveryType ∈ {delivery,pickup}`, `methodKey ∈ keys de paymentDetails`, `currency` con formato.
  2. Mover generación + upload del PDF a DESPUÉS del `payload.create` exitoso y ANTES de `storeCheckoutResponse` (la frontera del replay debe seguir guardando la respuesta completa con `pdfUrl`).
  3. Si el create falla tras el upload (raro): best-effort `deleteObject` del huérfano.
- **AC:**
  - [ ] `deliveryType:'teleport'` → rechazo genérico SIN generación de PDF ni PUT a R2 (mock).
  - [ ] Flujo feliz: respuesta con `pdfUrl` idéntica a la actual (test de contrato).
  - [ ] Replay: duplicado recibe la misma respuesta (test idempotencia existente verde).
- **Riesgo medio:** tocar la secuencia crítica → probar en preview con `/api/e2e/seed` + checkout manual.

## PR 5 — `fix(storefront)`: 404 solo para slug inexistente
- **ID:** SPEC-20260907-5 · **Origen:** C1 (3E-P2-1) · **Esfuerzo:** S · **Riesgo:** Bajo · **Schema:** No
- **Problema:** el `catch` genérico llama `notFound()` para CUALQUIER fallo (`[tenant]/page.tsx:184-196`): una caída de BD de 30s queda como **404 cacheado** de una tienda viva durante 5 min (ISR).
- **Cambios:** `notFound()` exclusivamente cuando el lookup del tenant devuelve `null`/slug reservado; cualquier otro error → `throw` (500 al error boundary, sin cachear 404).
- **AC:**
  - [ ] Simulación de fallo de BD (mock) → 500, no 404 cacheado.
  - [ ] `/tienda-inexistente` → 404 (smoke existente).
- **Patrón:** Next 15 App Router (notFound solo para "no existe").

## PR 6 — `fix(jobs)`: sweep de reconciliación + reporte de import + gate de cupo
- **ID:** SPEC-20260907-6 · **Origen:** B1+B2+B3 (3D) · **Esfuerzo:** L · **Riesgo:** Medio · **Schema:** Posible (ver split)
- **Problema:** fallo de `jobs.queue` = pedido sin Trello/email sin reparación (`checkout.ts:957-972`); diagnósticos de import (`errorCount`/`limitReached`) destruidos por `deleteJobOnComplete` (`catalog-import.ts:99,338` + `payload.config.ts:220`); cupo del plan no aplica a creación manual ni a downgrade (sin banner).
- **Patrones oficiales (Context7):** task con `schedule: [{ cron }]` para el sweep (auto-queue nativo, sin depender solo del runner externo); `payload.jobs.run({ where })` para ejecuciones filtradas.
- **Cambios (split recomendado en 6a/6b si el diff crece):**
  - **6a — Sweep:** task `reconcile-dispatch` con `schedule` (p.ej. cada 30 min): busca órdenes <48h con `trelloCardUrl` vacío/`__pending__` o `emailConfirmationSent:false` sin job vivo y re-encola con `jobs.queue` oficial.
  - **6b — Reporte + gate:** persistir mini-reporte de import (opción A: campo JSON en `tenants` — **requiere migración atómica**; opción B: `deleteJobOnComplete:false` solo para `catalogImportRows` + limpieza en el sweep) + `beforeChange` en `Products` con `getCatalogLimit` + banner en admin al alcanzar el cupo.
- **AC:**
  - [ ] Orden sembrada sin card/email → sweep la re-encola y el workflow la completa (test int).
  - [ ] Import de 600 filas en plan básico → reporte visible en admin: "N importadas, M omitidas por cupo".
  - [ ] Creación manual del producto 501 en plan básico → rechazo con mensaje claro.
  - [ ] Si 6b opción A: migración generada con `migrate:create`, revisada, registrada en `index.ts`, `generate:types` al día — commit atómico.

## PR 7 — `security(db)`: RLS en tablas de customers expuestas al Data API — ✅ APLICADO 2026-09-08
- **ID:** SPEC-20260907-7 · **Origen:** C3 (advisors ERROR de Supabase) · **Esfuerzo:** S · **Riesgo:** Bajo · **Schema:** BD-only (no Payload)
- **Problema:** `customers_purchase_history` y `customers_preferences_preferred_categories` en schema `public` sin RLS → lectura anónima potencial vía anon key.
- **Cambios (APROBADO por el dueño; DDL aplicado vía Supabase MCP/execute_sql, nunca pooler):**
  ```sql
  ALTER TABLE public.customers_purchase_history ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.customers_preferences_preferred_categories ENABLE ROW LEVEL SECURITY;
  CREATE POLICY payload_server_full_access ON public.customers_purchase_history FOR ALL TO postgres USING (true) WITH CHECK (true);
  CREATE POLICY payload_server_full_access ON public.customers_preferences_preferred_categories FOR ALL TO postgres USING (true) WITH CHECK (true);
  ```
  Policies `payload_server_full_access` (`TO postgres`, patrón idéntico a las otras 26 tablas del repo) por consistencia: `postgres` tiene `rolbypassrls=true` (verificado), así que la app queda intacta; para `anon`/`authenticated` = deny-all (ninguna policy les aplica).
- **Review Devin #97 (🟥 fresh databases omit RLS):** el DDL vivía SOLO en la BD de producción — una BD restaurada o recién provisionada recreaba las tablas SIN RLS (Payload no modela RLS) y el hallazgo C3 reaparecía. **Corregido**: migración `20260908_rls_customers_tables` registrada en `src/migrations/index.ts` → `prodMigrations` reproduce el estado en TODO arranque nuevo. Idempotente (DO blocks con detección en `pg_class`/`pg_policies` — `CREATE POLICY` no soporta `IF NOT EXISTS`); crea el role `postgres` si falta (BDs locales con otro owner). En el deploy de producción corre como no-op (el DDL ya está aplicado vía MCP); la fila queda registrada en `payload_migrations`.
- **AC:** [x] advisors de seguridad → **0 errores** (verificado: lint 0013 eliminado; solo quedan 2 INFO 0008 de `payload_jobs`/`payload_jobs_log`, intencionales y preexistentes); [x] smoke CRM: CRUD completo sobre `customers_purchase_history` como `postgres` (rol del pooler de Payload) OK en tx con ROLLBACK, y lectura de `customers` de producción intacta (totales CRM correctos); [x] DDL durable en migraciones (review Devin #97).
- **Rollback:** `DROP POLICY` + `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` (no necesario; estado inicial era el hallazgo C3).

## PR 8 — `test(inventory)`: corregir no-op + regresiones de transiciones
- **ID:** SPEC-20260907-8 · **Origen:** C5 (3B) · **Esfuerzo:** M · **Riesgo:** Bajo · **Schema:** No
- **Problema:** `tests/int/order-workflow.test.ts:55` crea producto con SKU timestamp pero la orden vende `'TEST-SKU'` → el hook no deduce nada (verde sin probar). Sin regresión para cancel→restore, delete→restore, delta de edición (el bug de Devin #73), reactivación.
- **Cambios:** corregir SKU + añadir los 4-5 tests de transición (contra BD aislada; CI los ejecuta con `TEST_DATABASE_URI`, `tests.yml:29`).
- **AC:** [ ] suite nueva falla si se reintroduce el bug de signo (validación de la red); [ ] CI verde.

## PR 9 — `fix(auth)`: política de revocación de sesión — DECISIÓN DE PRODUCTO
- **ID:** SPEC-20260907-9 · **Origen:** C2 (3C-P2-2) · **Esfuerzo:** S/M · **Riesgo:** Bajo · **Schema:** No
- **Problema:** `role`/`tenants` viajan en el JWT con `tokenExpiration: 7*24*60*60` (`Users.ts:7,51`): baja de un merchant deja su sesión activa hasta 7 días.
- **Opción A (recomendada si disponible en 3.88 — verificar en `node_modules` al implementar):** `auth: { useSessions: true }` — el JWT lleva `sid` y cada request valida contra la colección de sesiones en BD → **revocación inmediata** (fuente oficial `strategies/jwt.ts`; la tabla `users_sessions` ya existe). Coste: 1 query extra por request autenticado.
- **Opción B (mínima):** `tokenExpiration` 7d → 24h (opción oficial de `authentication/overview`). Escalación de incidentes en ambos casos: rotar `PAYLOAD_SECRET`.
- **AC:** [ ] cambiar `role`/`tenants` de un usuario → su sesión vieja denegada dentro del TTL elegido; [ ] login/admin OK.

## PR 10 — `refactor(catalog)`: helper compartido `loadProductIndexBySku`
- **ID:** SPEC-20260907-10 · **Origen:** Thermo D1 · **Esfuerzo:** S · **Riesgo:** Bajo
- Extraer a `src/lib/product-index.ts` la query `or:[{sku in},{'variants.sku' in}]` + maps `baseBySku`/`variantOwnerBySku` + agregado `qtyBySku` (duplicación exacta `checkout.ts:171-207` ≡ `Orders.ts:255-282`). Firmas preservadas; cero cambio de comportamiento; build+tests como red.

## PR 11 — `refactor(orders)`: `applyItemStockDelta` + `reconcileCrmBestEffort`
- **ID:** SPEC-20260907-11 · **Origen:** Thermo D2 · **Esfuerzo:** S-M · **Riesgo:** Bajo-Medio
- Colapsar el dispatch triplicado variante-vs-base (Orders.ts:327-355, 406-454, 609-652) en un helper con `checkStock` y el guard CRM best-effort triplicado (539-547, 675-683, 818-824) en `reconcileCrmBestEffort()`. **Invariante no negociable:** orden stock→CRM documentada. Red de seguridad: tests de `order-inventory` + PR 8.

## PR 12 — `refactor(cart-drawer)`: descomposición data-driven
- **ID:** SPEC-20260907-12 · **Origen:** Thermo D3 · **Esfuerzo:** M · **Riesgo:** Medio
- `cart-drawer/` con `payment-methods.tsx` (grid de 7 botones + cards de cuenta: `CopyRow` incrustado 17×, líneas 911-1262) y `checkout-form-sections.tsx` (5 formularios idénticos, 1288-1502). Config arrays con los classNames literales actuales → HTML byte-idéntico. `handleCheckout` (idempotencia) queda intacto. 1606 → ~550 líneas. Verificar con smoke de checkout en preview.

## PR 13 — `refactor(checkout)`: higiene de tipos + helper 7bis+8
- **ID:** SPEC-20260907-13 · **Origen:** Thermo D4 · **Esfuerzo:** S · **Riesgo:** Bajo
- Eliminar `as never` (`checkout.ts:923`) tipando el update de `crmCounted`; extraer secciones 7bis+8 (flag CRM + queue, 883-972) a helper con params explícitos; `averageOrderValue` desde el `RETURNING` del SQL atómico. **NO partir `processOrder`.**

## PR 14 — `refactor(landing)`: datos y constantes
- **ID:** SPEC-20260907-14 · **Origen:** Thermo D5 · **Esfuerzo:** S · **Riesgo:** Bajo
- `THEME_METAS.length` en los 4 hardcodes del "9" (landing-view.tsx:66,116,182,1087); arrays para pricing/FAQ/steps; constante para el WhatsApp mágico ×3; año del footer sin flash de hidratación.

---

## Orden de ejecución y dependencias

```
Semana de hardening:  PR 1 → PR 2 → PR 3 → PR 5 → PR 4   (riesgo ascender; 1-3 y 5 son de baja palanca)
Infra/observabilidad: PR 8 → PR 6a → PR 6b → PR 7 (con aprobación) → PR 9 (decisión)
Mantenibilidad:       PR 10 → PR 11 → PR 12 → PR 13 → PR 14 (PR 10 primero: desbloquea 11-13)
```
- PR 8 antes de PR 2/11: la red de tests primero.
- PR 9 requiere decisión del dueño (A vs B). PR 7 requiere aprobación de DDL.
- Cada PR termina en: build + lint + test verde → rebase → PR abierto → deploy preview verificado.
- **Definition of Done global:** los 14 mergeados (o descartados con razón), advisors de Supabase en 0 errores, re-auditoría puntual de los módulos tocados.

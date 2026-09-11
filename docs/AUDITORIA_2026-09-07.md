# AUDITORÍA COMPLETA 2026-09-07 — StoreLink SaaS (delta post PR #88)

> ⚠️ **ESTADO: HALLAZGOS RESUELTOS Y CONSOLIDADOS**  
> Todos los hallazgos P2 y refactors de esta auditoría (A1–A6, B1–B4, C1–C4, D1–D5) fueron remediados y mergeados en `main`.  
> Para la fuente única de verdad y el roadmap técnico vigente, consultar:  
> 🔗 [`docs/ESTADO_Y_ROADMAP_CONSOLIDADO.md`](ESTADO_Y_ROADMAP_CONSOLIDADO.md).

**Commit base:** `ea60fcf` (= `origin/main`, PR #88). **Alcance:** repo completo tras la auditoría final 2026-09-05 (score 9,0 GO). No se re-abren hallazgos ya cerrados de esa baseline; esta pasada audita el delta + dimensiones excluidas (§10): multi-tenant estructural profundo, inventario/CRM, jobs/observabilidad, mantenibilidad (4 archivos >1k) y BD (Supabase advisors).
**Método:** Fase 1 estático (lint/build/test/audit) + codegraph (índice local, 148 archivos) + 6 agentes paralelos por módulo + Supabase MCP (advisors seguridad/performance). Read-only: cero cambios de código.

---

## 1. Veredicto ejecutivo

**Score global: 8,8 / 10 — GO se mantiene.** Cero P0, cero P1 de producción (los P1 del bloque de mantenibilidad son calidad de código, no riesgo operativo). La plataforma sigue lista para producción; los hallazgos nuevos son 15×P2 y un backlog P3, mayormente de **integridad de datos secundaria** (CRM, títulos de pedido), **observabilidad de jobs** y **hardening**.

| Dimensión / módulo | Score | Resumen |
|---|---|---|
| Estático (lint/build/tests) | 9,5 | Todo verde; 151/162 tests (11 skips legítimos: 7 integración sin BD local — corren en CI, 4 migration-parity sin baseline). 2 CVE moderadas en deps |
| 3A Checkout & anti-abuso | 8,5 | Núcleo económico blindado (precios 100% server-side). P2: título del ítem confiado al cliente; PDF/R2 antes del create |
| 3B Pricing & inventario | 8,0 | Anti-sobreventa correcta por diseño SQL. P2: carrera doble-decremento CRM, restauración equivocada en cancel+edición, `quantity` sin `min` a nivel colección, test no-op |
| 3C Multi-tenant & acceso | 9,0 | Aislamiento verificado hasta el código del plugin instalado; pentest (a) cerrado estructuralmente. P2: `paymentStatus` forjable por el comprador; lag de revocación JWT 7 días |
| 3D Jobs & integraciones | 8,7 | Motor oficial correcto con retries/sentinels. P2: fallo de `jobs.queue` sin reparación, diagnósticos de import destruidos, scheduler único GH (60 días) |
| 3E Storefront & caché | 8,5 | Caché 3 capas sólida; P1-1 baseline confirmado cerrado. P2: error transitorio → 404 cacheado de tienda viva |
| 3F BD & migraciones (Supabase) | 8,5 | Schema sin drift detectable. **2 ERROR de advisors: tablas de customers sin RLS en schema público** |
| Mantenibilidad (thermo-nuclear) | 7,5 | 4 archivos >1k líneas; duplicación estructural concreta con plan de refactor de bajo riesgo |

---

## 2. Fase 1 — Estático

- `pnpm lint` ✅ 0 warnings · `pnpm build` ✅ (typecheck incl.) · `pnpm test` ✅ 151 pass / 11 skip (CI los cubre: `tests.yml:29` setea `TEST_DATABASE_URI`)
- `pnpm audit`: 2 moderadas — esbuild ≤0.24.2 vía `drizzle-kit` (solo toolchain de migraciones, no runtime) y `payload` account-unlock (GHSA-jg8r-5jh2-v2xj, **sin parche publicado aún**; mitigado: middleware rate-limita `/api/users/*` incl. unlock)
- Deuda: 1 único `as any` justificado (`payload.config.ts:254`), 1 `catch {}` real (`orders/[id]/status/route.ts:95`), cero TODO/FIXME reales

## 3. Hallazgos P2 (consolidados y deduplicados)

### Bloque A — Integridad de datos del checkout (bloque prioritario)

| # | Hallazgo | Evidencia | Impacto negocio |
|---|---|---|---|
| A1 | **`paymentStatus` forjable**: el comprador puede enviarse `paymentStatus:'verified'` y la orden nace "pago verificado" | `checkout.ts:826` persiste `customer.paymentDetails` tal cual; campo real en `Orders.ts:1039-1048` | Pedidos despachados sin pago real (salta la cola de reconciliación). Fix 1 línea: forzar `pending_verification` server-side + whitelist de claves |
| A2 | **Título del ítem confiado al cliente**: persistido en orden, PDF y WhatsApp | `checkout.ts:276` (`item.title \|\| dbProd.title`) + `itemsSummary` sin sanitizar `:474-476` | Facturación/ingeniería social falsa ("iPhone 16 Pro" en un pedido de $2). Fix: `dbProd.title`/`matchedVariant.name` |
| A3 | **Carrera doble-decremento CRM**: cancelación entre `crmCounted=true` y `findByID` resta 2 veces | `checkout.ts:916-943` + `Orders.ts:682-691` (mismo hallazgo por 2 agentes) | CRM corrupto silenciosamente (VIP perdido). Fix: `UPDATE ... SET crm_counted=true RETURNING status` atómico |
| A4 | **Cancelación + edición de ítems en el mismo save restaura cantidades nuevas, no las deducidas** | `Orders.ts:653-663` usa `doc.items` en vez de `previousDoc.items` | Deriva de stock permanente (+N). Fix 1 línea |
| A5 | **`items.quantity` sin validación a nivel colección**: `quantity:-5` por admin/REST AUMENTA stock | `Orders.ts:964-969` (el checkout valida 1-999, pero create/update por panel no) | Vector de corrupción de inventario. Fix: `min:1` + entero (sin migración) |
| A6 | **PDF+upload R2 antes de crear la orden**: validación provocable quema cuota R2 y deja PDFs huérfanos | `checkout.ts:764-794` vs `:817` | Quota R2 degradada por abuso (~2,1M ops/mes teóricas). Fix: validar `deliveryType`/`methodKey` + mover upload tras el create |

### Bloque B — Observabilidad y robustez de jobs

| # | Hallazgo | Evidencia | Impacto negocio |
|---|---|---|---|
| B1 | **Fallo de `jobs.queue` = despacho perdido sin cola ni reparación** | `checkout.ts:957-972` (solo console.error; no hay sweep) | Pedido real sin Trello ni email, invisible. Fix: sweep de reconciliación en jobs-health (re-encolar <48h sin card/email) |
| B2 | **Diagnósticos de import destruidos**: `errorCount`/`limitReached` mueren con el job (`deleteJobOnComplete:true`) | `catalog-import.ts:99,338` + `payload.config.ts:220` | "500 filas omitidas por cupo" jamás llega al admin. Fix: mini-reporte persistido o conservar job |
| B3 | **Cupo del plan no aplica a creación manual ni a downgrade**: productos invisibles sin banner | `Products.ts` sin gate `getCatalogLimit` + `storefront-cache.ts:157` | Producto 501 invisible en plan básico sin señal. Fix: gate en create + banner admin |
| B4 | **Punto único de scheduler**: GitHub desactiva schedules a los 60 días de inactividad; `jobs-health` muere con él | `.github/workflows/jobs-runner.yml:4-6` | Toda la capa retry/alerta/purga se apaga sin ruido. Fix: keepalive o cron externo redundante |

### Bloque C — Multi-tenant, storefront y BD

| # | Hallazgo | Evidencia | Impacto negocio |
|---|---|---|---|
| C1 | **Error transitorio → 404 cacheado de una tienda viva** (ISR cachea el `notFound()` del catch genérico) | `[tenant]/page.tsx:184-196` | Caída de BD de 30s = tienda "no existe" 5 min. Fix: `notFound()` solo para slug inexistente; `throw` para infra |
| C2 | **Lag de revocación JWT 7 días**: `role`/`tenants` viajan en el token; baja de un merchant no revoca su sesión | `Users.ts:7,51` + `payload.config.ts:64-66` | Ex-empleado opera hasta 7 días (acotado a sus tenants viejos). Decisión: `tokenExpiration` 24h o token-version; rotar `PAYLOAD_SECRET` para incidentes |
| C3 | **RLS faltante en 2 tablas de customers expuestas al Data API de Supabase** (ERROR de advisors) | `customers_purchase_history`, `customers_preferences_preferred_categories` (schema `public`, sin RLS) | Lectura anónima potencial de historial de compras vía anon key. Fix: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (el owner de Payload lo bypassa, app ilesa) — requiere aprobación del dueño |
| C4 | **SKUs duplicados resueltos no deterministas**: `sku` no es unique por tenant; el primero del find gana | `checkout.ts:189-194` + `Orders.ts:277-282` | Cobro/stock de producto A con catálogo mostrando B. Fix: validación unique-por-tenant + `sort:'id'` |
| C5 | **Tests de inventario: hueco real** — test con SKU no-op (verde sin probar deducción) y sin regresión en cancel/borrado/edición | `tests/int/order-workflow.test.ts:55` vs `:82` | Falsa confianza; el bug de signo de Devin #73 no tiene test. Fix: corregir SKU + 4 tests de transiciones |

### Bloque D — Mantenibilidad (thermo-nuclear, reabierto por decisión del dueño)

Plan de refactors por riesgo/ganancia (comportamiento y firmas preservados):

1. **Helper compartido `loadProductIndexBySku`** (checkout.ts:171-194 ≡ Orders.ts:255-282) — riesgo BAJO, ~30 líneas por archivo
2. **cart-drawer.tsx data-driven** (1606→~550): `CopyRow` incrustado 17× (líneas 911-1262), 5 formularios de verificación idénticos (1288-1502), 7 botones de pago (809-908) — riesgo MEDIO, diff mecánico con classNames literales
3. **Orders.ts**: `applyItemStockDelta` (dispatch triplicado: 327-355, 406-454, 609-652) + `reconcileCrmBestEffort` (×3) — riesgo BAJO-MEDIO
4. **checkout.ts**: quitar `as never` (:923), helper de secciones 7bis+8, avg CRM desde `RETURNING` — NO partir `processOrder`
5. **landing-view.tsx** (1109→~850): `THEME_METAS.length` en vez del "9" hardcodeado ×4, arrays para pricing/FAQ, constante WhatsApp

## 4. Backlog P3 (resumen — detalle en reports de agentes)

Textos del customer sin `maxLength` (persistencia de MB) · replay Redis con `pdfBase64` (PII 15 min) · `xff[0]` verificar dinámicamente · dinero en float sin cuantizar · fallback fuera de tx si la sesión no existe (`Orders.ts:66-69`) · reposición silenciosa de 0 filas · `purchaseHistory` read-modify-write · reposición pisa `out_of_stock` manual · límite "1-999" es por línea no por SKU · mensaje de error filtra nombre de otro tenant · enumeración REST anónima de datos públicos (decisión de diseño) · `request.json()` sin catch en status · ventana de email/Trello duplicado (sentinels no cubren fallo del update final) · fallo persistente de Trello bloquea el email del cliente · re-import cuadrático tras timeout · comment drift "30 días" vs 7 días reales del TTL R2 · `res.json()` sin guard en adapter Resend · CSV sin multi-línea RFC 4180 · monto Bs pre-checkout usa tasa ISR (etiquetar "aproximado") · `inMemoryCache` sin evicción · `showVES` del cliente sobreescribe al del tenant (`checkout.ts:568`) · errores del drawer vía `alert()` · `window.open` tras `await` en Safari · `getTenantBySlug` ×2 por render · SafeProductImage: filtrar whitelist en `toStorefrontProduct` (cierra §7.4 del baseline) · catch vacío `status/route.ts:95` · FKs de junction tables sin índice (volumen bajo; con P1 de baseline cuando escale) · índices "unused" = ruido de volumen (Payload `_order`, updated_at)

## 5. Plan de PRs propuesto (spec-from-findings, uno por fix, atómicos)

| PR | Contenido | Schema? | Riesgo |
|---|---|---|---|
| 1 | **A1+A2** — paymentStatus forzado server-side + título server-authoritative + sanitize `itemsSummary` | No | Bajo |
| 2 | **A3+A4** — claim atómico CRM con `RETURNING status` + restaurar `previousDoc.items` en cancelación | No | Bajo-Medio |
| 3 | **A5+C4** — `min:1`/entero en quantity + unicidad SKU por tenant + `sort:'id'` | No (validate) | Bajo |
| 4 | **A6** — validar `deliveryType`/`methodKey` + PDF/R2 tras el create | No | Medio |
| 5 | **C1** — storefront: 404 solo para slug inexistente | No | Bajo |
| 6 | **B1+B2+B3** — sweep de reconciliación + reporte de import + gate de cupo en create | Posible (tabla reporte) → migración atómica | Medio |
| 7 | **C3** — RLS en las 2 tablas (vía Supabase MCP con aprobación + registro en `payload_migrations` si aplica) | Sí (BD) | Bajo |
| 8 | **C5** — corregir test no-op + tests de regresión de transiciones de inventario | No | Bajo |
| 9 | **C2** — política de revocación (decisión de producto: 24h vs documentar) | No | Decisión |
| 10-14 | Thermo: refactors D1-D5 en ese orden, uno por PR | No | Bajo-Medio |

## 6. Qué sigue

1. Aprobar/descartar PRs 1-14 (los P3 quedan en backlog documentado)
2. Cada PR: implement → build/lint/test → rebase → PR (merge lo hace el dueño) → verificar deploy Vercel Ready
3. Baseline 05-sept: P1-1 confirmado cerrado; pentest (a) cerrado estructuralmente (plugin instalado verificado); §7.4 cierra con PR 5-adjacente (filtro en caché)

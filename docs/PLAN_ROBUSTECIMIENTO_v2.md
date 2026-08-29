# PLAN DE ROBUSTECIMIENTO v2 — storelink-saas

> ⚠️ **PLAN HISTÓRICO (Agosto 2026)**
> Este documento representa la planificación histórica de los sprints de robustecimiento tras la auditoría inicial.
> La gran mayoría de los ítems planificados en las tablas de sprints (PR-0 a PR-3a, R1 a R10) ya fueron implementados, validados con tests y mergeados en `main`.
> Consultar `git log`, `docs/ARCHITECTURE_AUDIT_REPORT.md` y `docs/HALLAZGOS_AUDITORIA_PROFUNDA_2026-08-29.md` para el estado técnico en tiempo real en producción.

**Fecha:** 2026-08-24 · **SHA base:** `78bf6e4` (clon `storelink-saas-audit-2026-08-24`)
**Sustituye a:** `PLAN_ROBUSTECIMIENTO_2026-08-24.md` (v1).
**Naturaleza:** documento de PLANIFICACIÓN HISTÓRICA.

## Fuentes re-verificadas para v2

1. Skill oficial de Payload (`reference/`: COLLECTIONS, FIELDS, HOOKS, ACCESS-CONTROL, ACCESS-CONTROL-ADVANCED, QUERIES) — cargada íntegra en la sesión.
2. Context7 `/payloadcms/payload` (docs oficiales + source de GitHub), 5 consultas:
   - **Jobs queue / retención:** confirmado desde `packages/payload/src/queues/operations/runJobs/index.ts` que `deleteJobOnComplete` solo borra jobs con status `success`; los fallidos (`hasError=true`) persisten indefinidamente y quedan excluidos del procesamiento (`{ hasError: { not_equals: true } }` en la query del runner). NV3/E5 es REAL.
   - **Slug nativo:** `{ name:'slug', type:'slug', useAsSlug }` fuerza por defecto `required+unique+index+sidebar`; el `unique` es GLOBAL → rompería slugs repetidos entre tenants en Categories. Matiz de v1 confirmado.
   - **Drafts:** `_status` se inyecta automáticamente y **todo create sin `_status` explícito nace `'draft'`**; lecturas REST/Local devuelven solo publicados salvo `draft:true`. Implica el nuevo riesgo R11 (imports invisibles).
   - **Orden de hooks en create (fuente oficial `collections/operations/create.ts`):** `beforeValidate` → `beforeChange` (colección) → `beforeChange` (campos, donde vive la validación) → write → `afterRead` → `afterChange`. Por tanto un guard en `hooks.beforeChange` DE COLECCIÓN rechaza ANTES de la validación de campos: diseño R1 válido tal cual.
   - **APIError:** patrón oficial `throw new APIError('mensaje', 403)` desde hooks (`docs/hooks/overview.mdx`) — código HTTP correcto garantizado en REST y admin.
   - **Plugin multi-tenant:** sus constraints se aplican como objetos Where (`getTenantAccess` / baseListFilter); un Where no es aplicable en CREATE (no hay documento que filtrar), consistente con la brecha A1 verificada en v1 sobre el dist 3.88.0.

---

## Cambios vs v1 (resumen de decisión)

| # | Cambio | Motivo |
|---|---|---|
| C1 | S0.4 (fail-fast de `PAYLOAD_SECRET`) ELIMINADO | Ya implementado en `src/payload.config.ts:196` (IIFE que lanza si falta la var). Era cosmético |
| C2 | B2 ampliado: corregir "30 días" en `checkout.ts:72` Y `checkout.ts:529` | El comentario erróneo está duplicado; TTL real 7d en `src/lib/delivery-note.ts:21` |
| C3 | R3 ampliado a 4 puntos de red | Sin timeout: Resend (`src/lib/email/resend-tenant-adapter.ts:58`), Trello (`src/lib/trello.ts:90`) y exchange-rate ×3 (`src/lib/exchange-rate.ts:34,49,64` — este corre en el camino crítico del checkout, `checkout.ts:240`). Patrón ya existente en el repo: `sync-sheets/route.ts:116` |
| C4 | R4 (`saveToJWT` en role): recomendación NO adoptar | Hoy Payload rehidrata `req.user` desde BD en cada request → cambios de rol aplican al instante. Con `saveToJWT` + `tokenExpiration` actual de 7 días (`Users.ts:7`), un rol revocado viviría hasta 7 días en el token. Solo adoptar si hay medición que lo justifique, y en par obligatorio con `tokenExpiration` 24h + refresh |
| C5 | Unicidad `(tenant, slug)` en Categories SIN DDL manual | Constraint del repo prohíbe SQL a mano. Vía A: `index: true` + check de duplicados en `beforeValidate`. Vía B (con excepción explícita): unique compuesto dentro de migración generada por `pnpm migrate:create` |
| C6 | CSP desplegada en dos fases | Una CSP con `script-src 'self'` sin nonces rompe el admin (inline bootstrap de Next). Fase 1: `Content-Security-Policy-Report-Only` o CSP sin `script-src`; añadir `*.vercel.app` a `img-src` (ya está en `images.remotePatterns`) |
| C7 | R2: cleanup vía endpoint con `x-cron-secret`, no TaskConfig suelta | Un task no se ejecuta solo: hay que encolarlo. Reusar el patrón existente de `payload.config.ts:176-187` (comparación timing-safe) y llamarlo desde el runner externo (GitHub Actions) |
| C8 | Drafts SOLO en products, nunca en Tenants | Config de tienda debe aplicarse al instante; drafts solo aportan valor como auditoría de catálogo. Nuevo R11 cubre el riesgo de creates invisibles |

---

## PARTE 1 — Ítems NO VERIFICADO y cómo se cierran

| # | Ítem abierto | Cómo se cierra | Sprint/PR |
|---|---|---|---|
| NV1 | Publicidad real del bucket R2 | Cloudflare dashboard: ¿`R2_PUBLIC_URL` sirve lectura pública sin firma? Si sí → M4 activo | PR-2b |
| NV2 | Headers efectivos en runtime + env vars de Vercel | `curl -I https://flow.martes.app` tras PR-0 + revisar env vars del proyecto | PR-0 |
| NV3 | Retención de `payload_jobs` | RESUELTO: fallidos persisten para siempre (fuente oficial, ver arriba). Cleanup en PR-2a | PR-2a |
| NV4 | Plan Vercel efectivo (timeout supuesto 10s) | Dashboard → Settings → Functions. Condiciona cotas de rate-limit y cap de carrito | PR-0/PR-1b |
| NV5 | Pentest dinámico (auth/IDOR en vivo) | Sesión manual sobre preview con dos cuentas tenant | PR-3b |
| NV6 | Skills parcheadas + perfil del repo | Diffs propuestos en cierre de auditoría — pendiente OK de Ángel | inmediato |

---

## PARTE 2 — Mejoras (versión final)

### R1 — Guard de escritura cross-tenant (cierra A1, hallazgo ALTO)
`src/hooks/ensureTenantMembership.ts` — factory `createTenantWriteGuard(collections)` que devuelve `CollectionBeforeChangeHook` (anotada con el tipo de Payload, sin `any`). Lógica: super-admin pasa; resto → normalizar `data.tenant` (id u objeto) ∈ `getUserTenantIds(req.user)` (reusar `lib/utils.ts:30-56`); si no → `throw new APIError('No tienes permiso sobre esta tienda', 403)`.
- Orden verificado: `beforeChange` de colección corre antes de validación (fuente oficial `create.ts`).
- Rechazo con HTTP correcto: `APIError(msg, 403)` (`docs/hooks/overview.mdx`).
- Alternativa oficial descartada: `accessResultOverride` / `useTenantAccess` del plugin operan con Where, que no protege CREATE de forma determinista. El hook sí.
- Cobertura: products, categories, orders, customers, media (las 5 del plugin, `payload.config.ts:48-54`).
- Criterio DURO: intento manual de create cross-tenant por REST devuelve 403 (empírico > fuente leída).

### R2 — Higiene de Jobs Queue (NV3/E5)
(a) `jobs.deleteJobOnComplete: true` explícito en config. (b) Endpoint mínimo `POST /api/admin/cleanup-jobs` protegido con `x-cron-secret` (patrón timing-safe de `payload.config.ts:176-187`) que ejecuta `req.payload.db.deleteMany({ collection: 'payload-jobs', where: { and: [{ hasError: { equals: true } }, { createdAt: { less_than: '<now-30d>' } }] } })` + log del count. Lo invoca el runner externo (GitHub Actions).

### R3 — Timeouts de red (ampliado)
`AbortSignal.timeout(10000)` en: resend-tenant-adapter.ts:58 · trello.ts:90 · exchange-rate.ts:34/49/64. Los reintentos ya existen (tasks con 3 attempts/backoff 30s, `src/jobs/order-created.ts:19,119`).

### R4 — saveToJWT en role: NO ADOPTAR (por defecto)
Mantener rol fresco desde BD. Reabrir solo con medición de latencia auth que lo justifique; en ese caso, par obligatorio: `tokenExpiration: 24h` + refresh del admin. Queda documentado como decisión, no como deuda.

### R5 — Slug nativo en Tenants
`{ name:'slug', type:'slug', useAsSlug:'name' }` sustituye al texto hand-rolled (`Tenants.ts:36-45`). Unique GLOBAL aquí es deseable (la slug es ruta pública de tienda). Verificar preview tras merge.

### R6 — Categories: index + unicidad lógica por tenant
`index: true` en slug (`Categories.ts:23-28`) + check de duplicado `(tenant, slug)` en `beforeValidate` (barato usando el índice). Opción B solo con excepción escrita de Ángel: unique compuesto editando el SQL de una migración generada.

### R7 — Security headers con CSP en dos fases
`headers()` en `next.config.mjs` + `poweredByHeader:false`. Fase 1 (PR-0): HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy `strict-origin-when-cross-origin`, Permissions-Policy mínimo, y CSP en modo Report-Only (o sin `script-src`) con `img-src 'self' blob: data: https://images.unsplash.com https://*.r2.cloudflarestorage.com https://*.supabase.co https://*.vercel.app`. Fase 2 (backlog): endurecer `script-src` con nonces si el stack lo permite.

### R8 — Rate-limit en rutas admin
Reutilizar el singleton Upstash fail-open con prefijos por ruta: `import-csv` 2/min, `sync-sheets` 4/min, `orders/[id]/status|pdf` 30/min. Fail-open se mantiene (decisión del dueño, ya documentada).

### R9 — Perf checkout
Tope de 30 items por pedido (const + error genérico) y UN solo find con `or:[{ sku:{in:skus} }, { 'variants.sku':{in:skus} }]` + `tenant equals` (sustituye el loop N×find de `checkout.ts:141-228`; resolver variantes/modificadores en memoria). Qty por item ya está acotada a 999 (`checkout.ts:144`).

### R10 — Observabilidad mínima
`console.error/warn` de guards/jobs con formato único `[storelink][componente] mensaje {contexto}` para grep en Vercel logs. Sin infra nueva.

### R11 — NUEVO: drafts visibles solo cuando toca
Si products gana `versions.drafts: true` (PR-3a), TODOS los creates programáticos deben fijar `_status: 'published'` explícitamente: import-csv, sync-sheets y cualquier seed. Sin esto, imports nuevos nacen draft e invisibles al storefront (comportamiento confirmado en docs oficiales). Tenants NO lleva drafts (C8).

---

## PARTE 3 — SPRINTS → PRs

Regla repo: 1 rama = 1 PR rebasado (`git fetch origin && git rebase origin/main`), `pnpm build` local 0 errores antes de abrir, identidad git del dueño, nunca merge por el agente. `pnpm generate:types` tras tocar colecciones.

### PR-0 · Quick wins (~45 min, riesgo bajo) — HOY
| Tarea | Archivo | Fuente |
|---|---|---|
| Security headers fase 1 + `poweredByHeader:false` (R7/C6) | next.config.mjs | Next docs headers/CSP |
| Fix comentario "7 días" en DOS sitios (B2/C2) | src/app/actions/checkout.ts:72 y :529 | delivery-note.ts:21 |
| Borrar `FALLBACK_EXCHANGE_RATE_VES` zombie (B8) — excepción `.env*` pedida en descripción del PR | .env.example:26 | grep cero usos |
| Confirmar plan Vercel real (NV4) | Dashboard, no código | AGENTS.md "validar contra entorno real" |

**Aceptación:** `pnpm build` 0 errores · preview Ready · `curl -I` muestra los headers · sin CSP que rompa admin.

### PR-1a · Guard multi-tenant (A1, hallazgo ALTO)
| Tarea | Detalle |
|---|---|
| Factory R1 en las 5 colecciones tenant-scoped | `CollectionBeforeChangeHook` tipada + APIError(403) |
| Vitest del guard | happy/super-admin/cross-tenant/anónimo (helpers puros, sin mock de Payload) |
| Test manual REST cross-tenant → 403 | Criterio empírico duro |

**Aceptación:** tests verdes · 403 verificado en preview · types regenerados si aplica.

### PR-1b · Anti-abuso y perf checkout
| Tarea | Detalle |
|---|---|
| Cap 30 items + find único `in[]` (R9) | checkout.ts:141-228 |
| Rate-limit R8 en las 4 rutas | Prefijos Upstash por ruta |
| Calibrar cotas según plan Vercel (NV4) | Documentar decisión en el PR |

**Aceptación:** build + tests verdes · checkout con carrito grande sigue funcionando · límites activos en preview.

### PR-2a · Higiene de jobs (puede ir en paralelo con 1b)
| Tarea | Detalle |
|---|---|
| `deleteJobOnComplete: true` explícito | payload.config.ts (jobs) |
| Endpoint cleanup-jobs + entrada en el runner externo | R2/C7 · secreto x-cron-secret |

**Aceptación:** job forzado a fallar queda registrado y purgado por el endpoint; log del count visible.

### PR-2b · Datos y resiliencia
| Tarea | Detalle |
|---|---|
| Best-sellers ventana 30d | analytics.ts:131-155 (añadir filtro temporal a la SQL agregada) |
| Migración índice `orders_items(_parent_id)` | SOLO `pnpm migrate:create` + revisión SQL; aplicar por conexión directa, nunca pooler |
| Timeouts R3 en los 4 puntos | AbortSignal.timeout(10000) |
| Verificar bucket R2 (NV1/M4) | Cloudflare dashboard; decidir privado+prefijo aleatorio |

**Aceptación:** best-sellers <200ms simulado · import de 500 productos sin colgar por red lenta · migración registrada en `payload_migrations`.

### PR-2c · CSV chunking reanudable (feature, aislado)
Lotes de 100 con cursor persistido; UI muestra progreso; sin estados intermedios corruptos.
**Aceptación:** 500 productos en ≤3 requests sin timeout, reanudable tras corte.

### PR-3a · Adherencia final
| Tarea | Detalle |
|---|---|
| Slug nativo Tenants (R5) | Verificar storefront tras merge |
| Categories index + unicidad lógica (R6/C5) | beforeValidate, sin DDL manual |
| Drafts SOLO products + `_status published` en imports (R11/C8) | import-csv, sync-sheets |
| saveToJWT: decisión documentada NO (R4/C4) o par 24h+refresh si Ángel decide lo contrario | Users.ts |
| Logging R10 | Formato `[storelink][componente]` |

**Aceptación:** re-auditoría de adherencia ≥90 · catálogo visible tras import en preview.

### PR-3b · Cierre
Pentest dinámico NV5 (dos cuentas tenant, IDOR/auth en vivo) documentado + parcheo de skills (NV6).

---

## Orden y dependencias

```
PR-0 ──► PR-1a ──► PR-2b/PR-2c (usan el guard para import seguro)
        └─► PR-1b ┘ (paralelo con PR-2a, independiente)
PR-3a ──► PR-3b (cierre)
```

## Riesgos transversales

- `.env.example` (PR-0): viola constraint nominal → pedir excepción EXPLÍCITA en la descripción del PR.
- Migraciones (PR-2b): aplicar por conexión directa, registrar en `payload_migrations`; jamás SQL a mano.
- Drafts (PR-3a): coordinar visibilidad con storefront y fijar `_status` en todo create programático; verificar en preview antes de merge.
- CSP (PR-0): si algo del admin/storefront se rompe en preview, retroceder a Report-Only puro.

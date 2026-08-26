# Auditoría revalidada — storelink-saas (2026-08-25)

Doble auditoría (code review + seguridad) **revalidada contra `origin/main`** (post PR #32–#39)
y contrastada con las fuentes oficiales:

- Docs de Payload 3 vía Context7 (`/payloadcms/payload`): jobs-queue/tasks, access-control, local-api, plugin-multi-tenant.
- Docs de Next.js vía Context7 (`/vercel/next.js`): file convention `manifest.ts`, `metadata.manifest`.
- Skill de Payload precargada (HOOKS.md, ACCESS-CONTROL.md, COLLECTIONS.md).

Metodología: cada hallazgo se verificó leyendo el código real en `origin/main` y se contrastó
con la documentación oficial. Los hallazgos corregidos por los PRs ya mergeados quedan
registrados como **RESUELTO** con su commit.

---

## 1. Hallazgos ya resueltos en `main` (verificados)

| Hallazgo original | Estado | Evidencia |
|---|---|---|
| **Bypass multi-tenant en CREATE** (crítico): el plugin aplica sus constraints como `Where` que filtran read/update/delete pero **no create**; el campo `tenant` del plugin no trae field-level access (`access: {}` en `tenantField/index.js`) | ✅ RESUELTO | `32fc01f` — hook `ensureTenantOnCreate` en las 5 colecciones tenant-scoped + `src/hooks/ensureTenantMembership.ts` (beforeChange → `APIError(403)`) + `tests/unit/tenant-guard.test.ts`. Es exactamente el patrón recomendado por Context7/skill: constraint de query no protege create; la protección va en un hook beforeChange o field-access. Verificado además contra el código real del plugin instalado (`node_modules/@payloadcms/plugin-multi-tenant/dist/fields/tenantField/index.js`). |
| Carrera lost-update en contadores CRM (`totalOrders`/`totalSpent`) | ✅ RESUELTO | `f1a030e` (F4) — `checkout.ts:500-501` usa `{ $inc: 1 }` / `{ $inc: total }` (operador atómico oficial). |
| Sin headers de seguridad / CSP | ✅ RESUELTO fase 1 | `f40841b` + `1de9ce4` — `next.config.mjs`: XFO DENY, nosniff, HSTS, Referrer-Policy, Permissions-Policy + CSP en Report-Only (pendiente fase 2: enforce con nonces). |
| Rate-limit ausente en imports/admin | ✅ RESUELTO parcial | `e552cd6` (R8) — import-csv 2/min, sync-sheets 4/min, orders 30/min. *Nota:* `forgot-password` es endpoint REST nativo de Payload (`/api/users/forgot-password`) y sigue sin límite propio; requeriría middleware o hook global. |
| `FALLBACK_EXCHANGE_RATE_VES` zombie · TTL "30 días" en comentarios · sin timeouts en fetch externos · cookie Secure/BYOK write-only · purga de jobs fallidos | ✅ RESUELTOS | `8063e03`, `ecac11e`, `f16caa7` (R3), `1268679` (F3/F5), `0d8c660` (R2/NV3). |

---

## 2. Decisiones de producto validadas (no son bugs)

### 2.1 Prefijo de país `58` hardcodeado → **DECISIÓN CORRECTA**

`checkout.ts:376` antepone `58` al teléfono del tenant si no lo trae:
`cleanPhone.startsWith('58') ? cleanPhone : \`58${cleanPhone}\``.

StoreLink opera exclusivamente en Venezuela (pago móvil, Zelle/VES, delivery Caracas,
`America/Caracas` en analíticas). Hardcodear `58` es coherente con ese alcance y elimina una
variable de configuración que el comerciante podría romper.

**Riesgo residual (copy, no código):** `Tenants.ts:68` sugiere en su description
*"ej: 34600111222 o 584121234567"*. Un admin que siga el primer ejemplo (España) recibe
pedidos hacia `5834600111222`, un WhatsApp inexistente → pierde ventas silenciosamente.
**Recomendación:** actualizar el texto a algo como *"Ej: 584121234567 (código Venezuela 58)"*.
Es solo copy del admin, no requiere migración ni cambia la decisión.

### 2.2 PWA rota → explicación

Dos fallos encadenados dejan la instalación PWA inoperante:

1. **El manifest apunta a una ruta que no existe.**
   `src/app/(app)/layout.tsx:9` declara `manifest: '/manifest.json'`. Pero Next.js App Router
   sirve `src/app/manifest.ts` en **`/manifest.webmanifest`** (docs oficiales Next.js,
   file-convention `manifest.ts`; el propio build genera `manifest.webmanifest`). Además, cuando
   existe `app/manifest.ts`, Next añade automáticamente el `<link rel="manifest">` correcto;
   declarar `metadata.manifest` manual lo sobreescribe con una URL 404.
   Resultado: el navegador pide `/manifest.json` → 404 → **no hay manifest → la PWA no es
   instalable**.
2. **Los iconos declarados no existen.**
   `src/app/manifest.ts:12-23` declara `/icon-192.png` e `/icon-512.png`, pero `public/` solo
   contiene `dashboard.png`. Chrome exige un icono ≥192px (idealmente también 512px) para
   considerar instalable la app; aunque se arregle la ruta del manifest, seguiría fallando.

**Fix propuesto:** eliminar `manifest` de `metadata` (dejar que Next auto-sirva el link a
`/manifest.webmanifest`) o apuntarlo explícitamente a esa ruta, y añadir los dos PNG reales a
`public/`.

### 2.3 Slugs hardcodeados heredados → explicación

Restos de la época en que la plataforma tenía **una sola tienda demo**:

| Archivo:línea | Fallback | Impacto real |
|---|---|---|
| `AnalyticsView.tsx:77` | `\|\| 'aurita'` | Si el usuario no tiene tenant resoluble, el control de tasa hace POST a `/api/aurita/exchange-rate`: **muta la tasa de una tienda arbitraria**. |
| `OrdersSyncPanel.tsx:7`, `ProductsSyncPanel.tsx:8` | `useState('aurita')` | Paneles de sincronización operan sobre la tienda equivocada si no se cambia el select. |
| `DiscreetSheetsSync.tsx:22` | `'don-luigi'` | Ídem, hardcodeado sin select. |
| `pdf.ts:66` | `'DON LUIGI & BURGERS'` | Nota de entrega PDF puede salir con la marca de OTRO comercio si `storeName` falta. |

Veredicto: **hallazgo válido (Medium)**. No es decisión de producto sino deuda de migración
multi-tenant. Fix trivial: eliminar fallbacks y renderizar estado "sin tienda asignada"
(el patrón ya existe en el branch `!isSuperAdmin && !tenantDoc` de AnalyticsView).

### 2.4 Catálogo truncado a 100 productos → explicación

`src/app/(app)/[tenant]/page.tsx:160`: el storefront consulta `payload.find({ collection:
'products', where: { tenant }, limit: 100 })` **sin paginación ni aviso**, dentro de una página
ISR (300 s).

Consecuencia: el producto #101 en adelante **no aparece en la tienda y nadie lo sabe** — no hay
error, log ni indicador. Con ISR encima, el hueco queda cacheado 5 minutos. Hoy las tiendas
reales están lejos de 100 SKUs, así que el riesgo es latente, no activo.

Opciones (de menor a mayor esfuerzo):
1. Subir límite con `select` de los campos que la UI usa (la query hoy trae documentos completos).
2. Paginar con `while (result.hasNextPage)` acotado a un máximo razonable (p.ej. 500).
3. UI de aviso si `totalDocs > docs.length`.

Veredicto: **hallazgo válido (Medium-latente)**. Decisión aceptable como MVP; documentarla y
meter el guard antes de tener clientes con catálogos grandes.

---

## 3. Hallazgos VIGENTES tras la re-auditoría (confirmados en `origin/main`)

### V-H1 · Stock de variantes nunca se descuenta (High — negocio/inventario)

- **Evidencia:** `src/collections/Orders.ts` (hook `manageOrderInventoryHook`): el `$inc`
  atómico se aplica solo sobre `products.stockQuantity` del producto **base**, gated por
  `prod.trackStock`. Ningún flujo modifica `variants[].stockQuantity`.
- **Contraste:** `checkout.ts:185-191` valida stock a nivel variante (`matchedVariant.stockQuantity`)
  y toma el precio de la variante — pero el descuento posterior ignora la variante. Doble error:
  sobreventa de tallas/variantes + descuadre del stock base si `trackStock=true`.
- **Patrón oficial:** skill HOOKS.md (collection hooks actúan sobre el documento completo) y el
  propio comentario del repo cita `@payloadcms/plugin-ecommerce/confirmOrder.ts` como referencia.
  La corrección requiere resolver la variante (por SKU) y aplicar `$inc` anidado
  (`variants.N.stockQuantity`) vía `db.updateOne`, o SQL directo a `products_variants`.
- **Test faltante:** integración que compre por SKU de variante y afirme qué campo decreció.

### V-H2 · Tarifa de delivery visible pero jamás cobrada (High — ingresos)

- **Evidencia:** `cart-drawer.tsx:589` muestra `(+$X)` por zona; `cart-drawer.tsx:202` calcula
  `total` solo con ítems; `checkout.ts` (reduce de `verifiedItems`) ídem; `Orders.ts` no tiene
  campo de tarifa de envío.
- El comerciante configura tarifas en `deliveryConfig.zones.priceDelivery`, el cliente las ve…
  y paga otro total. Pérdida directa de ingresos + disputas por WhatsApp.
- **Fix:** sumar la fee server-side según municipio/zona seleccionada y persistirla en la orden
  (campo nuevo vía `pnpm migrate:create`).

### V-H3 · Fallo de Trello = job exitoso, sin reintentos (High — fiabilidad)

- **Evidencia:** `trello.ts:97-107` devuelve `{ success:false }` en vez de lanzar;
  `order-created.ts:84-112` nunca consulta `trelloRes.success`: guarda
  `trelloCardUrl: undefined` y retorna output normal → tarea **succeeded**, workflow completado,
  job archivado.
- **Contraste Context7 (docs/jobs-queue/tasks.mdx):** *"If an error occurs, the task retries
  based on the configured limit before ultimately failing"* — los reintentos solo existen si el
  handler **lanza**. La guía de migración v4 lo hace explícito: *"Throw errors directly for task
  failures instead of returning state failed"*. Los `retries: { attempts: 3 }` de
  `order-created.ts:19` son hoy código muerto.
- **Fix:** `if (!trelloRes.success) throw new Error(\`Trello dispatch failed: ${trelloRes.error}\`)`.
  La idempotencia ya existe (`order.trelloCardUrl` check en :42) así que el reintento no duplica
  tarjetas.

### V-M1 · `paymentMethodsConfig` serializado completo al HTML público (Medium)

- `page.tsx:148` pasa el grupo entero a `StorefrontClient` (`'use client'`) → todas las cuentas
  bancarias (Zelle, Banesco Panamá, Binance, Zinli…), **incluidas las de métodos
  `enabled:false`**, viajan en el payload RSC de una página pública ISR-cacheada. El field-level
  access de `Tenants.ts:261-265` protege REST/admin, no esta serialización.
- Mostrar datos de pago al comprador es decisión de producto (transferencia directa); el mínimo
  innegociable es filtrar server-side los métodos deshabilitados y documentar la excepción en
  `docs/AGENTS_CONSTITUTION.md`.

### V-M2 · SVG permitido en Media (Medium)

- `Media.ts:28` → `mimeTypes: ['image/*']` incluye `image/svg+xml`. SVG puede incrustar scripts
  (stored XSS dependiendo del origen de servido). Fix: excluir svg explícitamente.

### V-M3 · Imports de catálogo N+1 secuencial (~10k queries/request) (Medium-perf)

- `sync-sheets/route.ts` e `import-csv/route.ts`: por fila → 1 find + 1 upsert, secuencial, con
  tope de 5000 filas. En Vercel + pooler 6543 esto es timeout seguro y sync parcial; además el
  bucle está duplicado 1:1 entre ambos archivos. Fix: helper compartido + resolución batch
  (`sku in [...]`) + chunks.

---

## 4. Resumen priorizado (estado actual de `main`)

| Prioridad | Acción | Esfuerzo |
|---|---|---|
| P1 | V-H1: descuento de stock de variantes (+ test) | Medio |
| P1 | V-H3: throw en fallo Trello (activa retries existentes) | Trivial |
| P1 | V-H2: cobrar y persistir delivery fee | Medio |
| P2 | PWA: ruta manifest + iconos en `public/` | Trivial |
| P2 | Slugs: eliminar fallbacks `'aurita'/'don-luigi'/'DON LUIGI'` | Trivial |
| P2 | Copy `Tenants.ts:68` (ejemplo España → Venezuela) | Trivial |
| P3 | V-M1: filtrar métodos de pago disabled antes de serializar | Bajo |
| P3 | V-M2: bloquear SVG en Media | Trivial |
| P3 | V-M3: batch import catálogo + deduplicar | Alto |

---

*Auditoría read-only: ningún archivo de `src/` fue modificado para producir este informe.*

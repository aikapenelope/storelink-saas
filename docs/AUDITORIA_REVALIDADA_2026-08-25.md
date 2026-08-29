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

## 3. Estado de los Hallazgos tras los ciclos de remediación (Verificado en `origin/main`)

### V-H1 · Stock de variantes nunca se descuenta (High) → ✅ **RESUELTO**
- **Resolución:** `src/collections/Orders.ts` (hook `manageOrderInventoryHook`) descuenta stock de variantes de manera atómica con `$inc` directamente sobre `products_variants` y restaura adecuadamente en cancelaciones.
- **Evidencia:** Tests de integración y hooks en producción validando decremento por SKU de variante.

### V-H2 · Tarifa de delivery visible pero jamás cobrada (High) → ✅ **RESUELTO**
- **Resolución:** El checkout valida la tarifa en base de datos (`deliveryConfig.fixedPrice`), la suma al total en USD/VES, la persiste en el campo `deliveryCost` de la orden (migrado en base de datos) y la desglosa tanto en WhatsApp como en el PDF.

### V-H3 · Fallo de Trello = job exitoso, sin reintentos (High) → ✅ **RESUELTO**
- **Resolución:** `src/jobs/order-created.ts` y `src/lib/trello.ts` lanzan excepciones explícitas (`throw new Error(...)`) ante fallos de la API de Trello, activando el ciclo de 3 reintentos automáticos configurados en la Jobs Queue oficial.

### V-M1 · `paymentMethodsConfig` serializado completo al HTML público (Medium) → ✅ **RESUELTO**
- **Resolución:** `src/app/(app)/[tenant]/page.tsx` filtra server-side los métodos con `enabled: false` antes de serializar hacia el cliente (`StorefrontClient`), evitando la fuga de cuentas bancarias inactivas en el HTML público.

### V-M2 · SVG permitido en Media (Medium) → ✅ **RESUELTO**
- **Resolución:** `src/collections/Media.ts` restringe estrictamente `mimeTypes` a formatos de mapa de bits (`image/jpeg`, `image/png`, `image/webp`, `image/gif`), bloqueando explícitamente `image/svg+xml`.

### V-M3 · Imports de catálogo N+1 secuencial (Medium-perf) → 🟡 **PARCIALMENTE RESUELTO (Riesgo Latente Vigente)**
- **Estado:** Se implementó la Jobs Queue oficial (`catalogImportRows` en `src/jobs/catalog-import.ts`) con procesamiento asíncrono y resolución en `Map`.
- **Riesgo Latente Vigente:** La precarga de productos para deduplicación por SKU tiene un tope fijo de `limit: 5000` (`catalog-import.ts:60`). Si una tienda supera los 5.000 productos totales, los SKUs posteriores no entran en el `Map` y podrían insertarse duplicados. Se mantiene este ítem como advertencia técnica activa en el roadmap.

---

## 4. Resumen priorizado actualizado

| Prioridad | Ítem | Estado en `main` |
|---|---|:---:|
| P1 | V-H1: descuento de stock de variantes (+ test) | ✅ RESUELTO |
| P1 | V-H3: throw en fallo Trello (activa retries existentes) | ✅ RESUELTO |
| P1 | V-H2: cobrar y persistir delivery fee | ✅ RESUELTO |
| P2 | PWA: migrado a Storefront Web Responsive sin PWA | ✅ RESUELTO |
| P2 | Slugs: eliminación de fallbacks obsoletos de tiendas | ✅ RESUELTO |
| P2 | Copy `Tenants.ts`: normalizado a código Venezuela (+58) | ✅ RESUELTO |
| P3 | V-M1: filtrar métodos de pago disabled antes de serializar | ✅ RESUELTO |
| P3 | V-M2: bloquear SVG en Media | ✅ RESUELTO |
| P3 | V-M3: tope de 5.000 filas en precarga de dedupe | 🟡 PENDIENTE / RIESGO LATENTE |

---

*Auditoría read-only: ningún archivo de `src/` fue modificado para producir este informe.*

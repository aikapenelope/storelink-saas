# Auditoría Integral — storelink-saas — 2026-09-04

Auditoría staff-level de producción-readiness ejecutada sobre `main` (`24ae7ac`, PR #71 mergeado).
Metodología: 12 fases (inventario → verificación empírica → seguridad multi-tenant → correctitud →
arquitectura → Payload → dependencias → rendimiento → testing/CI → observabilidad → SEO → privacidad).
Todo hallazgo fue verificado contra el código real (incluyendo el core de Payload instalado en
`node_modules` cuando el control vive fuera de `src/`) y contrastado con las auditorías previas
(`AUDITORIA_REVALIDADA_2026-08-25.md`, `HALLAZGOS_AUDITORIA_PROFUNDA_2026-08-29.md`) para no
re-reportar lo ya resuelto.

**Este informe va acompañado de un PR de remediación** que aplica los fixes de alta convicción y
verificables (marcados ✅ FIX EN ESTE PR). Los que requieren decisiones de producto/infra o trabajo
mayor quedan en el roadmap de la sección 7.

---

## 1. Veredicto ejecutivo

**Score global: 5.8/10 — 🟠 NO-GO remediable** (estado de `main` ANTES del PR de remediación;
proyectado ≥7.5 tras mergear este PR y completar los ítems de 30 días).

- **Estado real:** el núcleo duro está genuinamente bien construido (aislamiento multi-tenant con
  guard verificado en las 5 colecciones, inventario atómico `WHERE stock >= qty` dentro de la
  transacción del request, precios server-authoritative, BYOK write-only, secretos timing-safe).
  El riesgo no está en el diseño sino en las costuras: una colección interna de Payload abierta a
  cualquier usuario autenticado, órdenes editables/borrables sin ajuste de inventario, y una cadena
  de supply chain con 10 advisories HIGH de Next sin parchear.
- **Mayor riesgo:** `POST /api/payload-jobs` permitía a cualquier tenant-admin leer inputs de jobs
  de todos los tenants (CSV completo de catálogos) y encolar jobs arbitrarios contra el
  `tenantId` de otra tienda, que el runner ejecuta con `overrideAccess` — envenenamiento de
  catálogo cross-tenant con una cuenta legítima de comerciante. Cerrado en este PR.
- **Primera acción:** mergear el PR de remediación (cierra 5 de los 6 P1 accionables en código y
  baja las vulnerabilidades de 39 a 2 moderate), luego activar `SUPABASE_CA_CERT` en Vercel y
  verificar que el bucket R2 no expone `delivery-notes/` públicamente (ver hallazgo 15).

## 2. Puntajes por dimensión

La Fase 10 (SEO) aplica — storefront público con 9 temas. Se añade como dimensión 8 (5%) y
Correctitud pasa de 20% a 15%, según el modelo de puntaje del prompt maestro.

| # | Dimensión | Score | Peso | Justificación en 1 línea |
|---|---|---|---|---|
| 1 | Seguridad y aislamiento multi-tenant | 6.5 | 25% | Núcleo sólidísimo, pero el CRUD REST de `payload-jobs` quedaba en `Boolean(user)` (fuga cross-tenant real) y el fallback de `PAYLOAD_SECRET` cubría entornos no-Vercel. |
| 2 | Correctitud y confiabilidad | 5.5 | 15% | Inventario atómico y precios server-side correctos, PERO órdenes editables sin ajuste de stock, delete sin reposición, doble-submit sin idempotencia y tasa mostrada ≠ cobrada (4 P1 de dinero/inventario). |
| 3 | Arquitectura y mantenibilidad | 5.5 | 15% | Separación general correcta y utilidades canónicas, pero 4 monolitos >700 líneas (cart-drawer 1478) con lógica geo-VZ filtrada en código compartido y cálculo de dinero triplicado. |
| 4 | Testing y CI/CD | 6.0 | 15% | 119 tests con cobertura de los guards críticos (nonce, fail-open, tenant-guard, paridad de migraciones en CI con Postgres real), pero CI en rojo desde el 02-sep y sin lint/build/audit ni e2e en CI. |
| 5 | Rendimiento y escalabilidad | 7.0 | 15%→10%* | Doble capa de caché con invalidación completa verificada y batch fetches; faltan `select`, truncado silencioso a 500 productos e import fila-a-fila. |
| 6 | Observabilidad y operabilidad | 4.5 | 10% | Cero error tracking, cero alertas push de jobs (el runner puede morir en silencio a los 60 días), 48 `console.*` sin estructura y PII potencial en logs de errores. |
| 7 | Dependencias y supply chain | 5.0 | 5% | 39 vulnerabilidades (18 HIGH, 10 de Next 15.4.11 con auth bypass y SSRF) sin señal automatizada; buena postura base (lockfile, `packageManager`, `onlyBuiltDependencies`). |
| 8 | SEO técnico (storefront) | 4.5 | 5% | Metadata por tienda correcta, pero SIN sitemap, SIN robots.txt, SIN canonical y SIN JSON-LD — en un SaaS cuyo producto es tráfico orgánico. |

\* La tabla del prompt asigna 10% a Rendimiento tras redistribuir; los pesos suman 100%.

**Puntaje global = 6.5·0.25 + 5.5·0.15 + 5.5·0.15 + 6.0·0.15 + 7.0·0.10 + 4.5·0.10 + 5.0·0.05 + 4.5·0.05 = 5.83 ≈ 5.8**

**Gates:** global 5.0–6.4 → **🟠 NO-GO remediable**. No hay P0 (ningún hallazgo es explotable por
un atacante *externo* sin cuenta ni corrompe dinero de forma no mitigable), pero hay P1 sin plan
de 30 días formal hasta este PR. **Fixear y re-auditar** — este PR es precisamente esa remediación.

## 3. Fortalezas (verificar, no romper)

1. **Aislamiento multi-tenant real y probado**: hook `ensureTenantMembership` (403 en escritura
   cross-tenant) en las 5 colecciones tenant-scoped + constraints del plugin verificados contra
   `node_modules/@payloadcms/plugin-multi-tenant/dist/utilities/withTenantAccess.js` +
   `tests/unit/tenant-guard.test.ts` con casos negativos. El array `tenants` de users es
   super-admin-only a nivel field-access.
2. **Inventario atómico anti-oversell**: `UPDATE ... WHERE stock_quantity >= n RETURNING` dentro de
   la transacción del request (`req.transactionID`), con restauración simétrica en cancelación y
   dos checkouts concurrentes por la última unidad resueltos sin oversell (`order-checkout-lifecycle.test.ts`).
3. **Precios server-authoritative**: el cliente no envía precios; todo se re-resuelve desde BD
   (productos, variantes, modificadores) y la tasa VES del request se ignora.
4. **Secretos con higiene**: comparaciones `timingSafeEqual` en nonce/cron/e2e (fail-closed),
   BYOK Resend/Trello write-only (`read: () => false`), `.env*` fuera del repo, sin secretos
   hardcodeados (salvo el fallback de `PAYLOAD_SECRET`, cerrado en este PR).
5. **SSRF bien mitigado** en sync-sheets: host exacto `docs.google.com` + verificación del host
   FINAL tras redirects + timeout de 10s; whitelist única de hosts de imagen alimentando
   `next.config` + `Products.ts` + import + `SafeProductImage` (4 puntos de defensa, 0 `<img>` crudos en los 9 temas).
6. **Jobs Queue oficial** con reintentos 3×30s, sentinel de idempotencia Trello, `deleteJobOnComplete: false` para fallidos + purga >30d, y runner externo cada 5 min con secreto timing-safe.
7. **Caché con invalidación en cadena verificada**: Redis/memoria por tenantId (sin fuga cross-tenant
   de caché) + ISR 300s + `revalidatePath`/tags en TODAS las rutas de mutación, con pass
   post-commit anti-carrera.
8. **Migraciones disciplinadas**: 20/20 registradas en `index.ts` (ninguna huérfana), sin
   `NOT NULL` sin default, paridad verificada en CI contra Postgres real.
9. **Cultura de tests de regresión de auditoría**: cada fix histórico (V-H1, guard A1, nonce,
   fail-open, CSV injection, backfill Drive) tiene su test — los tests fallan si se rompe el control.

## 4. Hallazgos

Formato: **[P#] Título · [VERIFICADO|SOSPECHA] · Evidencia · Escenario · Impacto · Fix · Esfuerzo**.
✅ = fix incluido en este PR. 🔴 P0 (ninguno) · 🟡 P1 · 🟢 P2/P3.

### 🟡 P1

**1. [P1] CRUD REST de `payload-jobs` abierto a cualquier usuario autenticado — fuga cross-tenant y envenenamiento de catálogo · [VERIFICADO] ✅ FIX EN ESTE PR**
- Evidencia: `src/payload.config.ts:191-203` solo definía `jobs.access.run`; verificado en
  `node_modules/payload/dist/queues/config/collection.js` (la colección default no define `access`)
  y `node_modules/payload/dist/auth/defaultAccess.js` (`Boolean(user)`). El gate de `run` vive en
  el handler del endpoint (`queues/endpoints/run.js:10-27`), NO en las rutas CRUD.
- Escenario: un tenant-admin legítimo hace `GET /api/payload-jobs?limit=100` (lee `input.csvText`
  de catálogos completos de otros tenants y `orderId` ajenos) o `POST /api/payload-jobs` con
  `{ taskSlug: "catalogImportRows", input: { tenantId: VICTIMA, csvText: "..." } }` → en ≤5 min el
  runner ejecuta la tarea con `overrideAccess` e inyecta/sobrescribe productos de la tienda víctima.
- Impacto: lectura de datos comerciales cross-tenant + corrupción de catálogo de terceros.
- Fix: `jobsCollectionOverrides` (opción oficial de Payload 3.88, verificada en el core) cerrando
  read/create/update/delete a super-admin. El runner no pasa por ese access (usa `jobs.access.run`).

**2. [P1] Doble submit sin idempotencia de servidor — órdenes duplicadas · [VERIFICADO] ⚠️ ROADMAP 30d**
- Evidencia: `src/lib/checkout-nonce.ts:11-15` («Límite conocido y aceptado: NO es single-use»),
  `checkout-nonce.ts:63-64` (ventana efectiva 60 min), `checkout.ts` sin clave de idempotencia; la
  única protección de doble clic es `disabled={isLoading}` (`cart-drawer.tsx`).
- Escenario: doble clic con conexión lenta, reenvío desde dos pestañas o reintento del navegador
  tras timeout → dos órdenes, stock deducido dos veces, dos mensajes WhatsApp, dos tarjetas Trello,
  CRM contado dos veces (todo dentro de las cotas de rate limit).
- Impacto: pedidos duplicados reales; devoluciones; stock fantasma tras cancelar uno.
- Fix propuesto (M): hash SHA-256 de `tenant+items+customer+ventana-del-nonce` con `SET NX EX` en
  Upstash antes de crear la orden; o nonce single-use por carrito. **No incluido en este PR**
  porque introduce una dependencia dura del checkout con Upstash (decisión de disponibilidad que
  la constitución reserva al dueño; ver riesgos aceptados).

**3. [P1] Editar ítems de una orden activa no ajusta stock; la cancelación repone las cantidades EDITADAS · [VERIFICADO] ✅ FIX EN ESTE PR**
- Evidencia: `src/collections/Orders.ts` — el hook solo actuaba en `create`/reactivación/cancelación
  (`if (!isNewlyCreatedActive && !isReactivated && !isCancelled) return doc;`); la reposición usaba
  `doc.items` actuales; `items[].quantity`/`totalAmount` sin `readOnly` y `update` accesible.
- Escenario: orden de 2 unidades (se dedujeron 2). El admin edita a 5 por teléfono → stock sigue
  -2. Al cancelar repone 5 → +3 unidades que nunca existieron. Inversamente, reducir 5→1 y
  cancelar pierde 4 unidades de stock.
- Impacto: deriva de inventario silenciosa y acumulativa; overselling posterior.
- Fix: delta por SKU entre `previousDoc.items` y `doc.items` en cada update sin cambio de estado
  (aumento → deducción con `checkStock`, rechaza la edición si no hay inventario; disminución →
  reposición), todo dentro de la transacción del request.

**4. [P1] Borrar una orden activa NO reponía stock · [VERIFICADO] ✅ FIX EN ESTE PR**
- Evidencia: `src/collections/Orders.ts` — solo existían `beforeChange`/`afterChange`; `afterDelete`
  no existía y `delete` es accesible para el tenant.
- Escenario: admin borra una orden `pending` de prueba → la deducción del alta queda permanente.
- Impacto: pérdida de inventario irreversible sin traza.
- Fix: hook `afterDelete` que repone el stock de órdenes activas (misma semántica que cancelación;
  best-effort con log de reconciliación porque afterDelete no tiene rollback).

**5. [P1] Tasa VES mostrada al cliente ≠ tasa cobrada · [VERIFICADO] ✅ FIX PARCIAL EN ESTE PR**
- Evidencia: el carrito calcula Bs. con la tasa congelada en el HTML ISR (300s + `unstable_cache`
  120s: `[tenant]/page.tsx:29-33`), pero el servidor re-resuelve **en vivo** (`checkout.ts:580-582`)
  y la pantalla de pago muestra «Monto Exacto a Transferir» con la tasa vieja.
- Escenario: Binance P2P sube de 200 a 250 entre el render y el checkout → el cliente copia
  «Bs. 20.000» pero la orden/WhatsApp/PDF dicen «Bs. 25.000» → cobro insuficiente o cliente molesto.
- Impacto: descuadre sistemático con tasa automática; confianza del comprador.
- Fix en este PR (parcial): la respuesta del server action ahora incluye `totalUSD`/`totalVES`/
  `exchangeRateVES` confirmados por el servidor y la pantalla de éxito los muestra como «Monto
  confirmado». Fix completo (M, roadmap): resolver la tasa en el server action y mostrar la
  confirmación ANTES de crear la orden, o congelar la tasa del render dentro del nonce firmado.

**6. [P1] Fallback hardcodeado de `PAYLOAD_SECRET` en entornos no-Vercel · [VERIFICADO] ✅ FIX EN ESTE PR**
- Evidencia: `src/payload.config.ts:211-217` — el throw solo aplicaba con `process.env.VERCEL`;
  el fallback `'flow-martes-build-secret-key-32chars-min'` cubría cualquier otro runtime. Ese
  secreto firma los JWT de sesión y el HMAC del nonce.
- Escenario: staging self-hosted/Docker sin la var arranca con el secreto público del repo →
  suplantación de cualquier usuario (incluido super-admin).
- Fix: throw en TODO runtime de producción (Vercel o self-hosted); el fallback queda solo para
  dev/test y la fase de build de Next (`NEXT_PHASE`).

**7. [P1] CI en rojo desde 2026-09-02 — `tsc --noEmit` falla · [VERIFICADO] ✅ FIX EN ESTE PR**
- Evidencia: `tests/unit/order-inventory.test.ts:7` importa `ProductVariant` de `@/payload-types`;
  el archivo generado (cabecera «DO NOT MODIFY») ya no exporta ese tipo (solo `Product` con
  `variants` inline). Reproducido local: `error TS2305`. Los últimos 5+ runs de `tests.yml` fallan.
- Impacto: el gate de CI dejó de ser señal; los merges #70/#71 entraron con CI rojo.
- Fix: tipo indexado `NonNullable<Product['variants']>[number]` en el test (sin tocar el generado).

**8. [P1] Next 15.4.11 acumula 10 advisories HIGH sin parche en la línea instalada · [VERIFICADO] ✅ FIX EN ESTE PR**
- Evidencia: `pnpm audit --prod` en `main`: 39 vulnerabilidades (18 high), incluyendo CWE-288
  auth bypass (GHSA-267c-6grr-h53f, fix ≥15.5.18), CWE-918 SSRF (GHSA-p9j2-gv94-2wf4, fix
  ≥15.5.16), y 7 HIGH más de DoS/middleware cache.
- Escenario: un SaaS multi-tenant que expone rutas de API y admin está dentro de la superficie de
  las clases de CVE reportadas.
- Fix: `next`/`eslint-config-next` → 15.5.25 + overrides `fast-uri ^3.1.7` (4 HIGH),
  `postcss ^8.5.18` (2 HIGH) y `dompurify ^3.4.12` (5 moderate/low). **Resultado verificado: 39 →
  2 moderate** (el advisory de payload GHSA-jg8r-5jh2-v2xj aún no tiene versión parcheada
  publicada; monitorear).

**9. [P1] Sin `sitemap.xml`, `robots.txt` ni canonical · [VERIFICADO] ✅ FIX EN ESTE PR**
- Evidencia: `find src/app -name "sitemap*" -o -name "robots*"` vacío; `alternates.canonical`
  ausente; `constants.ts` reservaba los slugs `robots.txt`/`sitemap.xml` anticipándolos.
- Escenario: crawlers indexan `/admin`, `/demo` y la superficie API (robots allow-all por defecto),
  y cada variante de URL del storefront compite como contenido duplicado.
- Fix: `src/app/robots.ts` (disallow `/api/`, `/admin`, `/demo` + sitemap), `src/app/sitemap.ts`
  (estáticas + tenants reales con fallback estático en builds sin BD), `alternates.canonical` por
  tenant y `metadataBase` global.

**10. [P1] Cero JSON-LD en un e-commerce · [VERIFICADO] ✅ FIX EN ESTE PR**
- Evidencia: `grep "application/ld+json" src/` vacío.
- Impacto: sin rich results de precio/disponibilidad en Google — pérdida directa de CTR orgánico.
- Fix: JSON-LD `ItemList → Product/Offer` (precio, disponibilidad, imagen) en la página del
  storefront, con escape de `</` para blindar el script.

**11. [P1] Checkout recolecta PII sin aviso ni consentimiento · [VERIFICADO] ✅ FIX EN ESTE PR**
- Evidencia: `grep -rni "privacidad|privacy"` en `src/` vacío; el form envía nombre/teléfono/
  email/dirección sin checkbox ni enlace a política.
- Impacto: incumplimiento de mínimos GDPR/CCPA si hay clientes internacionales; riesgo reputacional.
- Fix: página `/privacidad` (finalidad, terceros WhatsApp/Resend/Trello/R2, retención, derechos,
  marco legal Venezuela/jurisdicciones), checkbox obligatorio antes del submit, slug reservado.

**12. [P1] Sin derecho al olvido ni retención definida · [VERIFICADO] ⚠️ ROADMAP 30d (M)**
- Evidencia: no existe endpoint/job de anonimización de clientes; las Notas de Entrega (PII: nombre,
  teléfono, dirección) viven en R2 indefinidamente (`delivery-note.ts`; la URL firmada expira, el
  objeto no); `purchaseHistory` crece a 50 entradas por cliente.
- Fix propuesto: action admin «anonimizar cliente» (borrar PII, preservar agregados) + job de purga
  de `delivery-notes/` >180d en el cron existente de cleanup + política documentada.

**13. [P1] Cero error tracking / alertas en el flujo de cobro · [VERIFICADO] ⚠️ ROADMAP 30d (M)**
- Evidencia: `grep -rn "sentry"` en `src/` y `package.json` = 0; el fallo del runner de jobs solo
  produce el email default de GitHub (que además desactiva schedules a los 60 días de inactividad
  del repo); `docs/RESEND_MONITORING.md` describe un webhook a Slack que no existe en el repo.
- Fix propuesto: `@sentry/nextjs` con `onRequestError` + `beforeSend` que strippee PII, o mínimo un
  log drain; healthcheck externo del runner (UptimeRobot/cron-job.org) sobre endpoint firmado.

**14. [P1] `cart-drawer.tsx` = 1478 líneas con lógica geo-VZ filtrada en código compartido · [VERIFICADO] ⚠️ ROADMAP 60d (M-L)**
- Evidencia: 5 responsabilidades en un archivo que entra en el bundle cliente de TODAS las tiendas;
  defaults de Caracas hardcodeados (`cart-drawer.tsx:203,612-618,647-663,1204-1214`): un tenant no
  venezolano vería municipios de Caracas y prefijo +58 fijo.
- Fix: descomposición concreta en la sección 6. La lógica geo debe extraerse a
  `src/lib/venezuela-checkout.ts` o hacerse configurable por tenant (perfil regional).

**15. [P1] Notas de Entrega (PII) en el mismo bucket R2 que las imágenes públicas · [SOSPECHA — requiere acción del OWNER] ⚠️**
- Evidencia: `src/lib/delivery-note.ts:45-47` guarda los PDF en `delivery-notes/` del MISMO bucket
  de Media; si `R2_PUBLIC_URL` expone lectura pública del bucket, el presign no protege nada y la
  key es enumerable (`YYMMDD-XXXXXX`, ~900k combinaciones/día). **No verificable desde el repo**
  (depende de la configuración del bucket en Cloudflare).
- Acción del owner: verificar que el bucket/dominio público NO sirve `delivery-notes/*` sin firma
  (regla de Cloudflare que deniegue el prefijo anónimo, o bucket separado). Si está público, este
  hallazgo escala a P0. Añadir verificación a CI/ops.

### 🟢 P2

**16. Endpoints REST nativos de auth sin rate limit por IP · [VERIFICADO] ✅ FIX EN ESTE PR** —
`/api/users/login|forgot-password|reset-password|unlock` sin throttle (Payload 3 eliminó el rate
limiter nativo; solo lockout por cuenta 5/10min). Fix: `src/middleware.ts` con contador en memoria
por instancia (10 POST/min/IP, fail-open), limitación declarada en el propio archivo. El `unlock`
además queda en defaultAccess — recomendado restringir a super-admin (no incluido: requiere
override de colección de auth; roadmap).

**17. Chequeo de stock por línea, no agregado por SKU · [VERIFICADO] ✅ FIX** — dos líneas del mismo
SKU (mismo producto con distintos modificadores) pasaban la validación independiente y el pedido
completo fallaba después en el hook. Fix: agregación `qtyBySku` en `verifyAndPriceItems`.

**18. `stockStatus: 'out_of_stock'` ignorado en el checkout · [VERIFICADO] ✅ FIX** — un producto
marcado agotado por el comerciante era comprable si `trackStock` estaba apagado o quedaba stock
residual. Fix: rechazo explícito de producto/variante `out_of_stock`.

**19. El agotamiento por venta nunca marcaba `out_of_stock` + serialización de 0 · [VERIFICADO] ✅ FIX** —
el SQL de deducción no tocaba `stock_status` (solo el import CSV lo hacía) y `prod.stockQuantity ?`
convertía el 0 en `undefined` en el storefront. Fix: `CASE WHEN (stock_quantity + delta) <= 0 THEN
'out_of_stock' ELSE 'in_stock' END` en los 3 UPDATEs de stock + chequeo por tipo en la serialización.

**20. Re-import sin columna de stock desactivaba `trackStock` de todo el catálogo · [VERIFICADO] ✅ FIX** —
`trackStock: stockQuantity !== undefined` en el update ponía `false` masivamente. Fix: solo
sobreescribir los campos de stock cuando el CSV trae el dato.

**21. Tarifa por zona ignorada: se cobraba la fija aunque la UI anunciara «(+$X)» · [VERIFICADO] ✅ FIX** —
server y cliente ahora resuelven `zones[].priceDelivery` por municipio seleccionado (fallback a
`fixedPrice`), con la fuente de verdad en el servidor.

**22. SKU sin constraint único (tenant, sku) — resolución no determinista · [VERIFICADO] ⚠️ ROADMAP (M)** —
`products.sku` tiene índice pero no único; con SKUs duplicados, precio cobrado y stock deducido
pueden salir de productos distintos. Fix propuesto: índice único compuesto + migración de dedupe.

**23. REST público agrega el catálogo de TODOS los tenants · [VERIFICADO] ⚠️ DECISIÓN DE PRODUCTO** —
`read: () => true` en products/categories/media sin constraint para anónimos: `GET /api/products`
devuelve la base agregada (SKUs, precios, stock) sin cuenta. No es PII, pero es el dato comercial
completo de cada tienda. Decidir: restringir a queries por tenant público o documentar como
abierto a propósito. No cambiado en este PR para no romper consumidores sin decisión del dueño.

**24. `prodMigrations` auto-ejecuta DDL en cada init de producción y el guard anti-pooler existe en
1 de 20 migraciones · [VERIFICADO] ⚠️ ROADMAP (M)** — el guard `[BLOCKED_TRANSACTION_POOLER_DDL]`
solo está en `20260902_alter_orders_exchange_rate_numeric.ts:34-42`; el resto confía en que la
conexión de runtime sea la correcta. Generalizar el guard a helper compartido.

**25. CI sin lint, build, audit ni Dependabot · [VERIFICADO] ✅ FIX** — `tests.yml` solo corría
typecheck+test; los errores que solo detecta el build llegaban a Vercel y los 39 advisories no
tenían señal. Fix: steps de Lint/Build/Audit + `.github/dependabot.yml`.

**26. e2e (Playwright) no corre en CI · [VERIFICADO] ⚠️ ROADMAP (M)** — specs sólidos pero solo
locales; la clase de fallo «render 500 por columna faltante» que detectan no tiene gate.

**27. TLS a Postgres sin verificación de identidad por defecto · [VERIFICADO] ✅ PARCIAL** —
`ssl: SUPABASE_CA_CERT ? {rejectUnauthorized:true} : {rejectUnauthorized:false}` y la var ni
siquiera estaba documentada. Fix parcial: documentada en `.env.example` con instrucciones; activarla
en Vercel es acción del owner (S).

**28. PII potencial en logs de errores crudos · [VERIFICADO] ✅ FIX** — `console.error(err)` de la
creación de órdenes adjunta el `data` de validación de Payload (nombre/teléfono/email/dirección).
Fix: solo mensajes en los catches del checkout y del storefront (con digest y tenant para correlación).

**29. Ventanas de duplicado en Trello/email y fallos sin re-encolado automático · [VERIFICADO] ⚠️ ROADMAP (S-M)** —
sentinel `__pending__` con ventana de duplicado si el update final falla; email re-enviable si el
crash cae entre envío y flag; jobs fallidos requieren intervención manual. Mitigables buscando card
existente por nombre y marcando intento antes de enviar.

**30. Landing y `/templates` client-only sin metadata propia · [VERIFICADO] ✅ FIX** — movidos a
server wrapper con metadata/OG/canonical (componentes en `src/components/landing/`).

**31. Import de catálogo por fila (N+1) y tope de dedupe 5.000 · [VERIFICADO] ⚠️ ROADMAP (M)** —
`payload.update/create` por fila; precios inválidos ahora se rechazan (✅ en este PR) pero el
batching y la paginación del prefetch quedan pendientes.

**32. Storefront: `limit: 500` sin `select` ni aviso de truncado · [VERIFICADO] ⚠️ ROADMAP (S-M)** —
el producto #501+ desaparece en silencio. Añadir `select` de los campos usados y log/UI cuando
`totalDocs > docs.length`.

### P3 (higiene — todos ✅ FIX EN ESTE PR salvo indicación)

**33.** Cookie de sesión sin `sameSite` explícito → `'Lax'` fijado. **34.** CORS/CSRF incluían
`localhost:3000/3001` en producción → condicionados a dev. **35.** Comentario de `maxDepth` decía
«→ 5», el valor es 3 → corregido. **36.** El comentario de `CRM_RECONCILIATION_ENABLED` decía
«Hoy = false» pero el flag está en `true` desde PR #67 → documentado el estado real. **37.**
`MAX_CHECKOUT_ITEMS` duplicado entre `checkout.ts` y `constants.ts` → import único. **38.** Prefijo
de fecha del orderNumber y fecha del PDF en TZ del proceso (UTC) → `America/Caracas` (constitución).
**39.** KPI `pending_count` excluyó siempre `confirmed` → incluido. **40.** `JobsStatusView` mostraba
jobs globales a cualquier tenant-admin vía bypass de access → solo super-admin. **41.** URL de
producción hardcodeada en `jobs-runner.yml` → `${{ vars.PROD_BASE_URL || ... }}`. **42.**
`userScalable: false` bloqueaba el zoom (WCAG 1.4.4) → eliminado. **43.** Precio inválido en import
se convertía en producto gratis → fila rechazada con errorCount. **44.** Dinero en `double
precision` (no `numeric(12,2)`) — ⚠️ roadmap; el redondeo de visualización es correcto y el riesgo
actual es de centavos en reporting. **45.** La respuesta del checkout incluye `pdfBase64` completo
además de `pdfUrl` — se mantiene por diseño (fallback local del drawer), documentado.

## 5. Riesgos aceptados re-evaluados

| Decisión documentada del dueño | Re-evaluación 2026-09-04 |
|---|---|
| **Rate limit fail-open** (Upstash caído = sin límite) | Sigue aceptable con el volumen actual: el nonce+honeypot siguen y hay cota por tenant configurable. Revisar al pasar ~50 checkouts/min sostenidos; considerar fail-closed con cota local de gracia para el checkout. |
| **Nonce no single-use** (ventana 60 min compartida por tenant) | Sigue aceptable como filtro anti-bot básico, PERO es la pieza que impide idempotencia de checkout (hallazgo 2). Si se hace el fix de idempotencia en 30d, resolver ambos juntos. |
| **CSP en Report-Only** | Mantiene su razón (rompería el admin sin nonces), pero lleva ~1 mes pendiente y en Report-Only no protege contra XSS. Mantener en backlog fase 2 con `unsafe-eval` eliminable primero. |
| **2FA no implementado** (decisión 2026-08-29) | Re-evaluado: con el hallazgo 6 (fallback de secreto) cerrado y el lockout por cuenta activo, el riesgo residencial es aceptable mientras el número de super-admins sea mínimo. Decisión de producto pendiente, no técnica. |
| **REST público del catálogo** (hallazgo 23) | **NUEVO — requiere decisión**: no estaba en la lista de riesgos aceptados. Documentar como abierto o restringir. |

## 6. Deuda técnica estructural (con descomposición concreta)

1. **`src/components/cart-drawer.tsx` (1478 líneas)** → orquestador de ~200 líneas + módulos:
   `cart/types.ts` (contratos, hoy duplicados de `storefront-client.tsx:106-172`),
   `cart/use-payment-methods.ts` (config + default, L142-179), `cart/use-checkout.ts`
   (handleCheckout + paymentLabel, L225-357), `cart/order-success.tsx` (L394-437),
   `cart/delivery-form.tsx` (L499-623), `cart/payment-method-button.tsx` (7 botones casi idénticos,
   L694-808 → 1 componente mapeado), `cart/payment-account-card.tsx` (5 tarjetas con copia por
   campo, L810-1185 → ~60 líneas genéricas), `cart/payment-verification-fields.tsx` (L1187-1401).
   Los cálculos de dinero → `src/lib/money.ts` (`formatUSD`, `formatVES`, `toVES`) como única
   fuente (hoy hay 3 convenciones conviviendo y el total VES se calcula en 3 capas).
2. **`src/app/actions/checkout.ts` (817+ líneas)** → `lib/checkout/validation.ts` (L89-123),
   `lib/pricing/verify-items.ts` (L129-228 — el pricing canónico de servidor),
   `lib/orders/order-number.ts`, `lib/whatsapp/message.ts` (L256-325, hoy duplicado en otro formato
   en `trello.ts:78-105`), `lib/crm/upsert.ts` (L331-489, junto a `applyCustomerCrmDelta` que vive
   en Orders.ts), `processOrder` queda como orquestador fino.
3. **`src/collections/Orders.ts` (713+ líneas)** → `lib/inventory/atomic-stock.ts`
   (`applyVariantStockDelta`, `applyBaseProductStockDelta`, resolver compartido),
   `lib/crm/delta.ts`, `hooks/manage-order-inventory.ts`; la colección queda en ~230 líneas.
4. **Constantes geo-VZ hardcodeadas** en el carrito (municipios, operadores, bancos) →
   `lib/venezuela-checkout.ts` o configuración por tenant (perfil regional) — prerrequisito para
   vender la plataforma fuera de Venezuela.

## 7. Roadmap 30/60/90

**30 días (cierra los P1 restantes):**
1. Idempotencia de checkout (hallazgo 2) — hash del pedido con `SET NX` en Upstash (M).
2. Error tracking: Sentry o log drain + healthcheck externo del runner de jobs (hallazgo 13) (M).
3. Derecho al olvido: action de anonimización + purga de `delivery-notes/` >180d en cleanup-jobs (M).
4. Índice único `(tenant_id, sku)` con migración de dedupe (hallazgo 22) (M).
5. Acción owner: activar `SUPABASE_CA_CERT` en Vercel; verificar que R2 no sirve `delivery-notes/`
   público (hallazgo 15); decidir hallazgo 23 (REST público del catálogo).
6. e2e en CI (job nocturno con el servicio Postgres ya definido) (M).

**60 días (deuda estructural):**
7. Descomposición cart-drawer/checkout/Orders según sección 6 (M-L, con e2e ya en CI como red).
8. Guard anti-pooler generalizado para las 20 migraciones + decisión de política de `prodMigrations`.
9. `select` + aviso de truncado en storefront; batching del import de catálogo.
10. CSP enforce fase 2 (nonces; eliminar `unsafe-eval` primero).

**90 días (robustez):**
11. `numeric(12,2)` para totales monetarios (hoy double precision).
12. Perfil regional por tenant (geo del checkout configurable).
13. Decisión 2FA (TOTP plugin vs passkeys vs no).
14. Re-evaluar rate limits y single-use de nonce con datos reales de tráfico.

## 8. Checklist de producción

| Ítem | Estado | Evidencia |
|---|---|---|
| Secretos y entorno | ⚠️→✅ | Fallback de `PAYLOAD_SECRET` cerrado en este PR; `SUPABASE_CA_CERT` documentada, **activar en Vercel (owner)**; rotación posible de cron/nonce secrets. |
| Backups/restauración | ⚠️ | Supabase tiene PITR según plan, pero no hay drill de restauración documentado ni testado. |
| Monitoreo y alertas | ❌ | Sin error tracking ni alertas de jobs; plan en roadmap 30d. |
| Rate limiting | ✅⚠️ | Checkout/IP/tenant/admin cubiertos con tests; fail-open documentado; auth endpoints ahora con middleware (aproximado por instancia); payload-jobs CRUD cerrado. |
| CSP y headers | ⚠️ | XFO/HSTS/nosniff/Referrer/Permissions en firme; CSP solo Report-Only (backlog fase 2). |
| 2FA | ❌ | Decisión de producto pendiente (lockout por cuenta activo como mitigación). |
| e2e en CI | ❌ | Playwright sólido pero solo local; job nocturno en roadmap. |
| Build/typecheck/lint/audit en CI | ✅ | `tests.yml` ahora con Lint + Typecheck + Test + Build + Audit; CI verde requerido para este PR. |
| Plan de rollback de migraciones | ⚠️ | `down()` presentes y paridad en CI; `migrate-direct.mjs` es one-off — generalizar. |
| Runbook de incidentes | ❌ | No existe; crear mínimo (schema drift, Upstash caído, tasa VES congelada). |
| Docs de onboarding | ✅ | AGENTS.md + constitución + guía de flujo, actualizadas y coherentes con el código. |
| Privacidad (aviso/consentimiento) | ✅ | `/privacidad` + checkbox en checkout (este PR); retención y anonimización en roadmap. |
| SEO base (sitemap/robots/canonical/JSON-LD) | ✅ | Implementado en este PR. |

## 9. Comandos ejecutados y salidas relevantes

| Comando | Resultado (ANTES del PR / DESPUÉS) |
|---|---|
| `pnpm install --frozen-lockfile` | ✅ exit 0 (6m11s en el bump de deps) |
| `pnpm lint` | ✅ «No ESLint warnings or errors» en ambos estados |
| `npx tsc --noEmit` | ❌ ANTES: `TS2305 ProductVariant` (tests/unit/order-inventory.test.ts:7) · ✅ DESPUÉS: 0 errores |
| `pnpm test` | ✅ ANTES: 119 passed / 11 skipped (int sin `TEST_DATABASE_URI`) · ✅ DESPUÉS: 119 passed / 11 skipped |
| `pnpm audit --prod` | ❌ ANTES: 39 vulns (18 high, 17 moderate, 4 low) · ✅ DESPUÉS: **2 moderate** (payload GHSA-jg8r-5jh2-v2xj sin parche publicado + dompurify residual de admin UI) |
| `pnpm build` | ✅ 0 errores en ambos estados (build incluye typecheck de la app) |
| `gh run list` (CI) | ❌ ANTES: `tests.yml` en failure desde 2026-09-02 (TS2305) · DESPUÉS: pendiente del run de este PR |

**Limitaciones del método:** sin BD local, los 11 tests de integración se saltan (corren en CI con
`TEST_DATABASE_URI` — el workflow los ejecuta en este PR); `payload-types.ts` no se regeneró en
local (requiere BD; no se tocó a mano); no hay acceso a dashboards Vercel/Upstash/Cloudflare — la
configuración real del bucket R2 (hallazgo 15) y las env vars de producción son acción del owner.

---

*Auditoría + PR de remediación 2026-09-04. Los fixes de este PR están listados con ✅; el resto
queda priorizado en la sección 7.*

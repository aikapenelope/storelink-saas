# AUDITORÍA FINAL — StoreLink SaaS (Fases 2–5)

**Fecha:** 2026-09-05 · **Alcance:** Fases 2→5 (robustez funcional/seguridad de superficie restante, capacidad, verificación dinámica, veredicto). La Fase 1 (fidelidad Payload) ya había sido auditada con resultado ALTO y no se re-abrió.
**Método:** auditoría READ-ONLY. Cero commits, cero writes en producción. Lectura completa (~10.200 líneas) de storefront, jobs, rutas API y `src/lib`; EXPLAIN/SELECT de diagnóstico vía Supabase MCP contra `storelink-db` (proyecto `mfcbeyajzjhgfwpxvdxz`); pentest anónimo de status codes contra producción.

---

## 1. Veredicto ejecutivo

**Score global: 9,0 / 10 — GO** para (a) comunicar límites a usuarios y **GO con 1 condición** para (b) escalar a N tiendas.

- **Cero hallazgos P0.** No hay ninguna ruta hacia pérdida de datos/dinero, fuga cross-tenant ni caída de servicio demostrable en la superficie auditada.
- **1 hallazgo P1** (límite de visualización de catálogo 500 vs importación 5000 — inconsistencia silenciosa al escalar).
- El pentest anónimo contra producción fue 100% correcto: todas las colecciones REST denegadas (403), endpoints cron protegidos (401), seed E2E muerto en producción (404).
- Todas las queries calientes usan índices y responden <1 ms con el volumen actual; los cuellos de botella a escala son cotas de plan (no de diseño).

---

## 2. Score desglosado por capa

| Capa | Score | Justificación |
|---|---|---|
| Compilación / tests | **8,5** | `pnpm build` (typecheck incl.) y `pnpm lint` exit 0; 151/155 tests verdes contra BD aislada (4 pendientes conocidos, ninguno de seguridad). `migrate:create` no corre en este entorno ni en Vercel (ESM top-level await) — proceso documentado y con flujo de emergencia. |
| Seguridad multi-tenant | **9,5** | Pentest anónimo: `GET /api/{tenants,customers,orders,users,payload-jobs}` → **403**; `POST /api/{orders,tenants}` anónimo → **403**; `POST /api/admin/cleanup-jobs` → **401**; `GET /api/admin/jobs-health` → **401**; `GET /api/payload-jobs/run?queue=default` → **401**; `POST /api/e2e/seed` → **404** (bloqueo duro por NODE_ENV). Estructura verificada: `overrideAccess:false + user` en TODAS las rutas que actúan por usuario; `overrideAccess:true` solo server-side de confianza; `createTenantWriteGuard` en las 5 colecciones del plugin; secretos cron/e2e timing-safe. Pendiente (a) con sesión real, ver §5. |
| Fidelidad Payload | **9,5** | Fase 1 resultado ALTO (guard A1, Jobs Queue oficial con CRUD cerrado, req en hooks/transacciones, context flags anti-loop, saveToJWT, write-only BYOK, fail-open rate-limit decidido con el dueño). Fase 2 no encontró desviaciones nuevas: Local API con `user + overrideAccess:false` (patrón QUERIES.md), `jobs.queue/runByID` oficiales, `db.deleteMany` solo sobre colección interna `payload-jobs` (sin hooks, documentado), adapter de email con interfaz oficial `EmailAdapter`. |
| Robustez funcional | **8,5** | Checkout client/server coherente (precios 100% server-side, totales confirmados por servidor en respuesta, idempotencia con token de intención persistido). HTML de email 100% escapado (`escapeHtml` + `sanitizePlainText`). CSV con cotas 2 MB/5000 filas y neutralización de fórmulas OWASP. SSRF de Sheets cerrado (hostname exacto + verificación del host final tras redirect + timeout 10s). Un P1: límite 500 productos storefront vs import 5000 (ver §3). |
| Capacidad | **9,0** | EXPLAINs: KPIs 0,8 ms (Seq Scan trivial hoy; `orders_tenant_idx`/`orders_tenant_created_idx` al escalar), series 0,2 ms, best-sellers 0,26 ms (join por `_parent_id` indexado), pricing checkout 0,14 ms (`products_tenant_idx`), storefront 0,08 ms. Volumen actual: 99 productos, 3 órdenes, 0 jobs en cola. Pool runtime `max:10` sobre Transaction Pooler 6543. |
| Evidencia dinámica | **7,5** | Smoke storefront: `/don-luigi` 200, `/aurita` 200, tenant inexistente 404, `/admin` 200. Pentest b/c/d ejecutado con evidencia (§5). No ejecutables en esta auditoría: pentest (a) con sesión tenant-admin (sin credenciales; crear usuarios en producción está prohibido) y checkout E2E completo (`/api/e2e/seed` responde 404 en cualquier deploy Vercel porque `NODE_ENV=production` también en previews; crear órdenes en don-luigi/aurita está prohibido). El workflow `order-created` queda cubierto por los tests de integración contra BD aislada (Fase 1). |

---

## 3. Hallazgos P0/P1

### P1-1 — Límite de visualización del catálogo (500) contradice el límite de importación (5000)

- **Severidad:** P1 (debe resolverse o publicarse antes de escalar; no bloquea hoy).
- **Ubicación:** `src/lib/storefront-cache.ts:70` (`limit: 500` en `getCachedProducts`, sin paginación) vs `src/lib/csv.ts:47` (`MAX_CSV_ROWS = 5000`) y `src/jobs/catalog-import.ts:71` (`limit: 5000` para el upsert por SKU).
- **Exploit path concreto:** un comercio importa por UI un CSV válido de 600 filas (la ruta lo acepta: 600 < 5000) → el job `catalogImportRows` crea los 600 productos en BD (correcto) → el storefront solo renderiza los primeros 500 (`getCachedProducts` con `limit:500`, sin `sort` determinista ni aviso) → **100 productos desaparecen de la tienda en silencio**; el admin los ve en su panel y no recibe ningún error. Impacto: catálogo incompleto sin señal = ventas perdidas; no hay pérdida de datos ni fallo de servicio (por eso P1, no P0).
- **Agravante latente:** `catalog-import.ts:71` carga el mapa de SKUs existentes con `limit:5000`; un tenant con >5000 productos creados repetiría SKUs (duplicados) en re-imports. Inalcanzable mientras el catálogo visible esté acotado a 500.
- **Fix propuesto (PR 1, sin schema):** en `getCachedProducts`, paginar (`limit:500` por página hasta agotar) **o** elevar a 5000 con `sort: 'createdAt'`, y en ambos casos: (a) log del recorte, (b) banner en el admin cuando `count >= límite` y (c) publicar el límite en `docs/GUIA_GESTION_FLOW.md`. Alternativa mínima: dejar 500 y documentarlo como límite oficial del plan (ver §4) + rechazar imports >500 filas.
- **Estado:** PROPUESTO (no implementado durante la auditoría — read-only).

**No hubo hallazgos P0 en Fases 2–4.** El resto de sospechas investigadas se cerraron sin exploit demostrable (ver §7 preguntas abiertas).

---

## 4. Límites publicables por tienda (Fase 3)

Cada límite con el mecanismo que lo respalda y el modo de degradación. Cotas de plan marcadas ⚠️ = confirmar con el dueño en el dashboard (no están en el repo).

| Dimensión | Límite publicable | Mecanismo verificable | Si se supera |
|---|---|---|---|
| Productos por tienda | **500** | `getCachedProducts` `limit:500` (`storefront-cache.ts:70`) | Productos adicionales invisibles en storefront (ver P1-1) |
| Filas por importación CSV/Sheets | **5.000 filas / 2 MB** | `MAX_CSV_ROWS`/`MAX_CSV_BYTES` (`csv.ts:44-47`) validado en ambas rutas | Rechazo 400 con mensaje claro (sin corrupción) |
| Fotos por producto (import) | **6** | `slice(0,6)` en `catalog-import.ts:109`; hosts en whitelist https-only | URLs extra descartadas en silencio |
| Ítems por pedido | **30 líneas** | `MAX_CHECKOUT_ITEMS` (`constants.ts:14`), revalidado server-side | Rechazo del checkout |
| Cantidad por SKU | **1–999 / pedido** | `verifyAndPriceItems` (`checkout.ts:211`), stock agregado por SKU | Rechazo con mensaje |
| Pedidos/minuto por IP+tienda | **5** (config `RATE_LIMIT_CHECKOUT_PER_MIN`) | Rate-limit Upstash (`rate-limit.ts`), nonce HMAC 30 min + honeypot + timestamp <3s | 429; fail-open documentado si Upstash cae (decisión del dueño) |
| Visitantes concurrentes | **~50–100 por tienda** sin degradación perceptible | ISR 300s + Redis TTL 180s amortiguando BD; pool DB `max:10`; bandwidth Vercel ⚠️ 100 GB/mes (Hobby) | Degradación gradual de latencia; ISR sirve caché; nunca error duro. El storefront sigue sirviendo si Supabase/Upstash fallan (fallback memoria/BD y fail-open) |
| Pedidos/día (plataforma) | **≈5.000** con Upstash free ⚠️ 10k req/día | 1–2 ops Upstash por submit (idempotencia + rate-limit); regeneraciones ISR cada 300s no pasan por Upstash salvo cache-miss | Al agotar: fail-open (checkout continúa sin idempotencia/rate-limit — degradación documentada, no caída) |
| Emails/mes por tienda | **~3.000 con clave master** ⚠️ Resend free 100/día, 3.000/mes | 1 email de confirmación por pedido; BYOK del tenant elimina el límite compartido | El job reintenta 3×; la orden NO se pierde (WhatsApp/Trello/R2 son los canales primarios) |
| Notas de entrega (R2) | **~200.000 PDFs** ⚠️ R2 free 10 GB, Clase A 1M/mes | PDF ~40–60 KB c/u; 1 PUT por pedido; descargas solo vía URL firmada TTL≤7d (`delivery-note.ts`) | Fallo de subida → PDF ausente, orden intacta (degradación esperada) |
| Usuarios admin por tienda | **10 (recomendación)** | Sin límite técnico; `tenants` array solo lo toca super-admin | — |
| BD total | **500 MB** ⚠️ Supabase free | Uso actual ~1,5 MB; 99 productos + 3 órdenes | Aviso de Supabase; margen enorme |

**Proyección:** a 20 tiendas × 500 productos × 500 órdenes/mes ≈ 10k productos (~20 MB) + 10k órdenes/año (~40 MB con items) — la BD free aguanta años; los primeros techos reales son Upstash (req/día) y bandwidth de Vercel, ambos mitigables con upgrade de plan, no con cambios de código.

---

## 5. Verificación dinámica (Fase 4) — evidencia

| # | Prueba | Resultado | Evidencia |
|---|---|---|---|
| 0 | Smoke storefront | ✅ | `GET /don-luigi` → 200; `GET /aurita` → 200; `GET /tienda-inexistente-xyz` → 404; `GET /admin` → 200 |
| b | REST anónimo: leer tenants / customers / orders / users / payload-jobs | ✅ denegado | 403 en los cinco (bodies sanitizados: error genérico Payload, sin datos) |
| b2 | CREATE anónimo (guard A1): `POST /api/orders` y `POST /api/tenants` | ✅ denegado | 403 ambos |
| c | Cron endpoints sin `x-cron-secret` | ✅ denegado | `POST /api/admin/cleanup-jobs` → 401; `GET /api/admin/jobs-health` → 401; `GET /api/payload-jobs/run?queue=default` → 401 (`{"message":"No autorizado…"}`) |
| d | `POST /api/e2e/seed` en producción | ✅ muerto | 404 (bloqueo duro `NODE_ENV === 'production'`, `e2e/seed/route.ts:38`) |
| a | Sesión tenant-admin A → recursos del tenant B (REST + admin + CREATE con tenant ajeno) | ⚠️ NO EJECUTADO | Sin credenciales de tenant-admin disponibles (crear usuarios en producción está prohibido por la regla 4). Cobertura estructural: tests 151/155 contra BD aislada (Fase 1) incluyen guards cross-tenant; revisión estática confirma `overrideAccess:false + user` en todas las rutas por-usuario. **Pendiente:** ejecutar script de pentest autenticado en entorno no-prod con credenciales de prueba. |
| E2E checkout completo (render → carrito → nonce/honeypot → orden → Trello/R2/email → analytics) | ⚠️ NO EJECUTADO en vivo | El seed E2E responde 404 en cualquier deploy de Vercel (`NODE_ENV=production` también en previews) y crear órdenes en los tenants reales está prohibido. Cubierto por tests de integración contra BD aislada (Fase 1). Nota operativa: para E2E en preview habría que habilitar una condición de entorno distinta de `NODE_ENV` (p.ej. `VERCEL_ENV !== 'production'`) en `e2e/seed/route.ts:38`. |

---

## 6. Matriz de fidelidad Payload (resumen actualizado Fase 1+2)

| Patrón oficial | Implementación | Veredicto |
|---|---|---|
| Local API `user + overrideAccess:false` (QUERIES.md) | import-csv, sync-sheets, exchange-rate, orders pdf/status | ✅ Fiel |
| `overrideAccess:true` solo server-side de confianza | jobs, tenant lookup público, exchange-rate (con `assertTenantAccess` como defensa en profundidad) | ✅ Fiel y documentado |
| Jobs Queue oficial (`jobs.queue`/`runByID`, `access.run` cron-secret) | checkout, catalog-import, runner externo GH Actions cada 5 min | ✅ Fiel; CRUD de `payload-jobs` cerrado (403 anónimo verificado en vivo) |
| `req` en hooks/transacciones | order-created, catalog-import, Orders hooks | ✅ Fiel (Fase 1) |
| Context flags anti-loop | `skipRevalidate` en imports, flags de checkout | ✅ Fiel |
| Access control plugin multi-tenant | `createTenantWriteGuard` + `tenantsArrayField.arrayFieldAccess` super-admin | ✅ Fiel |
| Storage oficial (storage-s3/R2) | Media público por diseño; delivery-notes SIEMPRE presigned TTL≤7d | ✅ Fiel + hardening |
| Email adapter oficial (interfaz `EmailAdapter`) | `resend-tenant-adapter` verificado contra `@payloadcms/email-resend@3.88.0` real | ✅ Fiel (divergencias documentadas como mejoras) |
| Desviaciones deliberadas (aprobadas) | sin versions/drafts; slug como text (unicidad compuesta `(tenant_id,slug)` en categories — migración verificada en BD) | ✅ Evaluadas, no re-abiertas |

---

## 7. Preguntas abiertas (no son hallazgos — sin exploit demostrable)

1. `products_variants.sku` sin índice: el subplan del pricing del checkout hace Seq Scan sobre `products_variants` (hoy 0 filas). **Propuesta de índice (PR 2, con `migrate:create`):** `CREATE INDEX CONCURRENTLY products_variants_sku_idx` y compuesto `products(tenant_id, sku)` cuando un tenant supere ~10k productos. Nunca DDL manual.
2. `sync-sheets` descarga el cuerpo completo (`res.text()`) antes de validar los 2 MB: una hoja anómala de un tenant muy grande presionaría memoria de la función (Vercel Hobby 1 GB) pero es recurso del propio tenant y no demostró ruta de caída del servicio. Vigilar si algún tenant publica hojas >50 MB.
3. `POST /api/payload-jobs/run` devuelve 404 (la ruta oficial es GET): solo documentación operativa para nadie que intente integrar por POST.
4. `SafeProductImage` renderiza con `<img>` nativo URLs de hosts fuera de la whitelist (degradación deliberada para no tumbar SSR): una URL https histórica de host arbitrario cargaría igual. Products.ts ya valida al guardar; considerar endurecer el `<img>` nativo a la whitelist también.

---

## 8. Plan de PRs propuestos (post-auditoría, uno por fix, atómicos, rebasados, build verde)

1. **`fix(storefront)`: límite de catálogo visible** — paginar/elevé `getCachedProducts` + warning admin + documentación (cierra P1-1). Sin schema.
2. **`perf(products)`: índices propuestos** — `products_variants(sku)` + `products(tenant_id, sku)` vía `migrate:create` con conexión directa; solo si se decide acercar el límite de catálogo a miles (expand/contract, `CONCURRENTLY`). Con migración atómica en el mismo PR.
3. **`docs(guia)`: sección "Límites del servicio"** — publicar la tabla de §4 en `docs/GUIA_GESTION_FLOW.md` para onboarding de comercios. Solo docs.
4. **`chore(e2e)`: habilitar seed en previews** — condición `VERCEL_ENV !== 'production'` en `e2e/seed/route.ts:38` + script de pentest autenticado (hallazgo (a)) para ejecutar con credenciales de prueba en preview. Sin schema.

---

## 9. GO / NO-GO

**(a) Comunicar límites a usuarios: GO.** Todos los límites de §4 tienen mecanismo verificable y degradación esperada documentada. Recomendación: publicar la tabla (PR 3) ANTES de comunicar, y fijar "500 productos" como límite oficial hasta resolver P1-1.

**(b) Escalar a N tiendas: GO con 1 condición.** Condición: cerrar o publicar P1-1 (límite de catálogo) antes de incorporar comercios con catálogos grandes. El resto de la plataforma (seguridad multi-tenant, cola de jobs, BD, emails, storage) soporta el crecimiento con margen; los techos futuros son de plan de servicio, no de diseño.

---

## 10. Apéndice — excluidos por decisión del dueño (una línea c/u)

- Sentry/observabilidad: fuera de alcance.
- P2/cosméticos (rate-limit de auth en memoria por instancia; `encodeURIComponent` del teléfono en links wa.me del admin; `request.json()` sin catch en exchange-rate → 500 genérico): fuera de alcance.
- Refactors estructurales de mantenibilidad: fuera de alcance.
- Regulatorio/producto (derecho al olvido, aviso de privacidad como feature —el checkbox de consentimiento ya existe—, métricas de negocio): fuera de alcance.

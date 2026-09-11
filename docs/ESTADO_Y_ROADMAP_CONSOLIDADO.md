# ESTADO TÉCNICO Y ROADMAP CONSOLIDADO — StoreLink SaaS

> 📌 **DOCUMENTO CANÓNICO / FUENTE ÚNICA DE VERDAD**  
> **Fecha de actualización:** 2026-09-11  
> **Estado de la Plataforma:** Producción Activa (`main` @ commit `d5b09a2`)  
> **Score de Auditoría:** 9.2 / 10 (GO Definitivo para Escala)  
> **Sustituye y consolida:** `docs/ROADMAP_SPRINTS.md`, `docs/ROADMAP_POST_AUDITORIA_2026-09-07.md`, `ROADMAP_V2.md` y notas de auditorías previas.

---

## 1. Arquitectura y Stack en Producción

* **Framework:** Next.js 15.5.25 (App Router, Server Components nativos, `await params` / `await searchParams`).
* **CMS & Backend:** Payload CMS 3.88 con arquitectura TypeScript-first y Local API estricta (`user + overrideAccess: false`).
* **Base de Datos:** PostgreSQL en Supabase gestionado vía Transaction Pooler (puerto `6543`) en runtime Vercel Serverless. Migraciones aplicadas determinísticamente desde baseline (`src/migrations/20260909_baseline_schema.ts`).
* **Almacenamiento de Medios y PDFs:** Cloudflare R2 vía S3 Storage Adapter (`@payloadcms/storage-s3`) con URLs firmadas con caducidad de 7 días (`src/lib/delivery-note.ts`).
* **Anti-abuso & Caché:** Upstash Redis (Serverless) gestionando Nonces criptográficos HMAC SHA-256 (30m), Honeypot invisible y Rate Limiting por IP/Tenant (`slidingWindow`) con arquitectura *fail-open*.
* **Colas de Integraciones:** Payload Jobs Queue oficial (`order-created`, `catalog-import`, `reconcile-dispatch`) con doble despacho (inmediato con `after()` de Next.js + reintentos automáticos mediante runner externo en GitHub Actions).

---

## 2. Inventario de lo que YA ESTÁ IMPLEMENTADO Y VERIFICADO (100% en `main`)

Todas las áreas auditadas entre el 4 y el 11 de septiembre de 2026 cuentan con código productivo y suites de pruebas automatizadas (246 tests unitarios pasando, linter 0 warnings y build verde):

### 2.1. Blindaje del Checkout e Integridad de Datos
* **PaymentStatus y Títulos Server-Authoritative (PR #90):** El servidor fuerza siempre `paymentStatus: 'pending_verification'` y toma los títulos directamente de la base de datos (`matchedVariant?.name || dbProd.title`), ignorando datos arbitrarios del cliente (`src/app/actions/checkout.ts`).
* **Whitelists y Saneamiento Estricto (PR #90, #94, #116):** Normalización de `paymentDetails`, enums cerrados para `deliveryType` y `methodKey`, validación de código ISO-4217 de moneda y cotas de longitud en todos los campos de texto (`src/lib/checkout-sanitize.ts`, `src/lib/checkout-validation.ts`).
* **Upload de PDF Posterior a la Creación de la Orden (PR #94):** La generación y subida del comprobante a Cloudflare R2 ocurre únicamente tras el `payload.create` exitoso de la orden, previniendo cuotas quemadas y PDFs huérfanos.
* **Manejo Determinista de SKUs (PR #93):** Hook `beforeValidate` (`rejectDuplicateSkuPerTenant` en `src/collections/Products.ts`) que rechaza SKUs duplicados por tienda, complementado con ordenación canónica `sort: 'id'` en el checkout.
* **Validación de Cantidad en Órdenes (PR #93):** Regla `min: 1` y validador entero en `orders.items.quantity` a nivel de colección para impedir manipulaciones de stock por REST o panel.
* **Claim Atómico de CRM y Deducción de Stock (PR #92):** Ejecución SQL atómica vía Drizzle (`UPDATE orders SET crm_counted = true WHERE id = $1 RETURNING status`) para evitar condiciones de carrera (TOCTOU). Cancelación de órdenes restaura stock con base en `previousDoc.items`.

### 2.2. Base de Datos, Seguridad y Multi-Tenant Isolation
* **Cadena de Migraciones Baseline (PR #112):** Archivo `20260909_baseline_schema.ts` registrado como primer elemento de `prodMigrations`, permitiendo recrear la base de datos completa desde cero en entornos locales o de testing.
* **Row Level Security (RLS) Completo en Supabase (PR #113):** Todas las tablas públicas de PostgreSQL cuentan con políticas RLS activas (`ENABLE ROW LEVEL SECURITY`), eliminando el riesgo de acceso anónimo indebido vía PostgREST / Supabase Data API.
* **Índices FK de Relaciones Junction (PR #114):** Índices creados en columnas foráneas de tablas secundarias (`orders_items`, `customers_purchase_history`) para acelerar joins analíticos.
* **Aislamiento Multi-Tenant Estricto (PR #119, #122, #123):** Todas las Server Actions y lecturas analíticas corren con `overrideAccess: false` pasando el usuario autenticado vía `headers()`, delegando la segregación de datos al plugin multi-tenant oficial de Payload.

### 2.3. Resiliencia de Jobs, Storefront y Catálogo
* **Sweep de Reconciliación de Despachos (PR #96, #110):** Tarea programada (`reconcile-dispatch.ts`) que detecta órdenes con más de 10 minutos sin tarjeta de Trello o confirmación por correo y re-encola los jobs pendientes automáticamente.
* **Reporte de Importación de Catálogo (PR #96):** Los jobs de importación CSV/Sheets persisten su resumen (`createdCount`, `updatedCount`, `skippedCount`) evitando que los diagnósticos mueran al completarse.
* **Control de Capacidad por Plan de Tienda (PR #96):** Límite configurado por planes (`Básico`: 500, `Estándar`: 1000, `Pro`: 2000 en `src/lib/tenant-plans.ts`), con gate de creación manual (`enforceCatalogLimitOnCreate`) y alerta visual en el panel (`CatalogLimitBanner.tsx`).
* **Protección de Caché ISR en Storefront (PR #95):** El storefront (`src/app/(app)/[tenant]/page.tsx`) únicamente emite `notFound()` ante slugs de tiendas verdaderamente inexistentes; los fallos de base de datos propagan 500 para evitar que una caída transitoria quede cacheada como 404 durante 5 minutos.
* **Sitemap Force-Dynamic (PR #117):** Configuración `dynamic = 'force-dynamic'` para evitar ejecuciones de base de datos durante el paso estático de `next build` en Vercel.

### 2.4. Directorio de Compradores (CRM de Clientes)
* **Backend y Agregaciones SQL (PR #119):** Server Actions de alta velocidad (`fetchCustomersPage`, `updateCustomerNotes`, `updateCustomerTag`, `importCustomersBatch`, `exportCustomersCsv`) en `src/app/actions/admin-customers.ts`, apoyadas por agregaciones SQL nativas (`getCustomerKpis` en `src/lib/analytics.ts`).
* **Componente de Gestión Shopify Brutalist Dark (PR #122):** `CustomersRegistryManager.tsx` con estética nativa en `zinc-950`, tabla de alta densidad en desktop, tarjetas táctiles en móviles, filtros RFM (`VIP`, `Recurrentes`, `Nuevos`, `Inactivos`), Drawer de ficha de cliente y herramientas de difusión vía WhatsApp.
* **Integración en Panel de Analíticas (PR #123, #124):** Selector de pestañas reactivo (`AnalyticsDashboardClient.tsx`) con navegación fluida, sincronización bidireccional de URL (`?tab=customers`), KPIs reactivos y fallback determinista ante parámetros no reconocidos.

---

## 3. Lo que REALMENTE Falta (Roadmap Vigente y Priorizado)

Con las fases críticas de seguridad, transaccionalidad y CRM terminadas, los siguientes ítems componen el backlog real para la evolución del sistema:

### Fase 1: Hardening de Acceso y Operación (Prioridad Inmediata)
1. **Política de Expiración de Sesión JWT (`Users.ts` — PR 9 histórico):**
   * *Situación actual:* `tokenExpiration` está configurado en 7 días (`7 * 24 * 60 * 60`).
   * *Acción:* Reducir a 24 horas (`24 * 60 * 60`) para garantizar que la baja o cambio de rol de un comerciante invalide sesiones obsoletas en un lapso razonable sin incurrir en el costo de sesiones en base de datos.
2. **Runbook de Respuesta a Incidentes (`docs/RUNBOOK.md`):**
   * *Situación actual:* No existe un manual formal de contingencia.
   * *Acción:* Documentar los procedimientos operativos estándar para el dueño:
     - Contingencia ante caída temporal de Upstash Redis (modo fail-open).
     - Desincronización o indisponibilidad de tasas de cambio (Binance / Dólar Paralelo).
     - Protocolo de purga y reintento manual de jobs atascados en `payload-jobs`.
     - Protocolo de reparación de schema drift vía Supabase MCP.

### Fase 2: Performance y Escala de Catálogo (Sprints 1 & 5)
3. **Optimización con `select` Explícito en Storefront (`P2-32`):**
   * *Situación actual:* `getCachedProducts` y `getTenantBySlug` consultan documentos completos de productos.
   * *Acción:* Implementar parámetro `select` de Payload para traer únicamente los atributos necesarios para el renderizado del storefront, reduciendo el tamaño del payload RSC en más de un 60% para tiendas grandes.
4. **Inserción Batch Multi-Row en Importación CSV (`P2-31`):**
   * *Situación actual:* `catalog-import.ts` procesa filas individualmente mediante la Local API de Payload.
   * *Acción:* Migrar la inserción a sentencias multi-fila de Drizzle (`db.insert().values([...])`) para acelerar la ingesta de archivos de hasta 5.000 filas a menos de 30 segundos.

### Fase 3: Observabilidad y Producto (Sprints 2 & 6)
5. **Monitoreo y Reporte de Errores en Producción:**
   * Configurar `@sentry/nextjs` con integración de `onRequestError` de Next.js 15 y release tracking en Vercel.
6. **Robustecimiento del Runner de Jobs (GitHub Actions vs QStash):**
   * Evaluar la migración del trigger de cron a QStash si los intervalos del tier gratuito de GitHub Actions continúan presentando retrasos superiores a 1 hora.
7. **Autenticación en Dos Pasos (2FA) para Super-Admin:**
   * Incorporar plugin de 2FA / TOTP oficial para cuentas de administración global de la plataforma.

---

## 4. Guía de Referencia Rápida para Desarrolladores y Agentes

* **Nunca asumir tareas de documentos desactualizados:** Siempre verificar el código fuente en `src/` o el historial de Git antes de proponer cambios sobre funcionalidades existentes.
* **Prohibido alterar DDL o esquemas manualmente:** Todo cambio a `src/collections/*.ts` debe acompañarse de su migración atómica generada mediante `pnpm migrate:create` y registrada en `src/migrations/index.ts`.
* **Identidad de autor requerida:** `AngelDelN <57774536+aikapenelope@users.noreply.github.com>`.
* **Regla de despliegue:** Nunca hacer push directo a `main`. Trabajar siempre por ramas de feature/fix y abrir Pull Requests para validación de CI.

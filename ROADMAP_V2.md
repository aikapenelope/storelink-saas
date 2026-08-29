# 🗺️ Roadmap V2 — Escala 100–200 Tiendas

> Documento de ingeniería derivado de la auditoría de seguridad y rendimiento (Ago 2026).
> Los ítems críticos de **seguridad** ya están resueltos en la rama `fix/security-audit-payload-official`.
> Este roadmap agrupa lo necesario para que la plataforma aguante 100–200 comercios concurrentes
> sin degradar latencia, agotar cuotas de serverless ni saturar Supabase.

---

## 1. 🚄 Caché y renderizado del storefront → ✅ **RESUELTO**

- **Implementado:** Storefront migrado a ISR con `revalidate = 300` y revalidación granular por tag (`revalidateTag`) y ruta en mutaciones de inventario y pedidos.
- **Ruta de tasa:** Cacheada con Upstash Redis y TTL de 300s. Carrito 100% interactivo en el cliente.

## 2. 📦 Imports batch (Google Sheets / CSV) → ✅ **RESUELTO**

- **Implementado:** Procesamiento mediante Jobs Queue oficial de Payload (`catalogImportRows` en `src/jobs/catalog-import.ts`).
- Pre-carga en memoria (`Map` de SKUs y Categorías) para evitar consultas N+1 y dual-dispatch (`after()` instantáneo + reintentos por runner externo de GitHub Actions).

## 3. 📊 Analíticas sin cargar la DB en memoria → ✅ **RESUELTO**

- **Implementado:** Módulo `src/lib/analytics.ts` con agregaciones SQL nativas vía Drizzle (`sql\`COUNT(*)\``, `sql\`SUM(total_amount)\``, `sql\`DATE_TRUNC(...)\`` en zona horaria `America/Caracas`). Eliminadas las sumas manuales en memoria.

## 4. 🛡️ Rate-limiting y abuso del checkout → ✅ **RESUELTO**

- **Implementado:** Pipeline anti-abuso de 3 etapas en `src/app/actions/checkout.ts`:
  1. Nonce criptográfico HMAC SHA-256 con ventana de 30m.
  2. Honeypot invisible + validación de tiempo mínimo de llenado (3 segundos).
  3. Rate limiting por IP/Tenant con Upstash Redis (`slidingWindow`) bajo arquitectura fail-open.

## 5. 🔁 Cola de integraciones salientes → ✅ **RESUELTO**

- **Implementado:** Payload Jobs Queue (`order-created.ts`) desacopla Trello, generación de PDF y correos de confirmación Resend. Reintentos automáticos configurados ante fallos de red.

## 6. 🗃️ Base de datos y Almacenamiento → ✅ **RESUELTO**

- **Pooler:** Transaction Pooler en puerto 6543 en Supabase.
- **Certificado SSL:** `SUPABASE_CA_CERT` activo y verificado en Vercel producción.
- **Media:** Cloudflare R2 con adapter S3 oficial y control de tipos MIME / tamaño (5MB max).

## 7. 🧾 Números de pedido y conciliación → ✅ **RESUELTO**

- **Implementado:** `orderNumber` único autogenerado con `crypto.randomInt` + snapshot congelado de `exchangeRateVES` por pedido.

## 8. 📈 Observabilidad → 🟡 **PENDIENTE**

- Sentry (frontend + server) con release tracking de Vercel.
- Log drain de Vercel hacia proveedor externo (Axiom / Better Stack) con alertas de error rate > 1%.
- Uptime monitors automáticos con ping cada 5 minutos por comercio.

## 9. ⚠️ Riesgos Técnicos y Pendientes Activos

1. **Límite de precarga de dedupe (5.000 filas en `catalog-import.ts`):** La deduplicación en memoria precarga hasta 5.000 productos con `limit: 5000`. Catálogos de comercios que superen ese volumen total podrían omitir SKUs en el `Map` y generar duplicados. Se requiere paginación por cursor para catálogos masivos.
2. **CSP en modo Enforce:** Se mantiene en `Report-Only` para garantizar la compatibilidad con el Admin de Payload.
3. **2FA para Super-Admin:** Pendiente de priorización futura.

---

### Criterio de "listo para 200 tiendas"

| Métrica | Objetivo |
|---|---|
| TTFB storefront p95 | < 400 ms (cacheado) |
| Checkout completo p95 | < 2.5 s |
| Queries por pageview tienda | ≤ 1 (cache hit) |
| Import 1.000 productos | < 60 s, sin timeout |
| Error rate global | < 0.5% |
| Coste infra mensual | < $80 (Vercel Pro + Supabase Pro + R2 free) |

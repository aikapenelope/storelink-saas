# Hallazgos de la Auditoría Profunda — storelink-saas (2026-08-29)

Memo de **hallazgos y recomendaciones**, sin cambios de código. Complementa el ciclo de PRs
de esta misma auditoría (tests de regresión, PWA→web responsive, Trello BYOK). Los tres
puntos de abajo requieren una decisión explícita del dueño antes de implementarse — dos de
ellos (CSP enforce, 2FA) porque pueden romper el flujo de login/admin en producción si se
hacen mal, y el tercero (cola async del import) porque es una decisión de arquitectura, no
un bug.

Metodología: cada hallazgo se verificó contra el código real de `main` y contra la skill
oficial de Payload precargada en este ciclo (`packages/payload/skills/payload/SKILL.md` y
`reference/*.md` del repo `payloadcms/payload`, clonado para esta auditoría) — nunca contra
suposiciones. Cualquier implementación futura de estos puntos debe repetir esa consulta
(Context7 / skill oficial) antes de escribir código, por el Protocolo de 5 Fases de
`docs/AGENTS_CONSTITUTION.md`.

---

## 0. Hallazgo cerrado en este mismo ciclo (para trazabilidad)

Al implementar el BYOK de Trello (ver PR correspondiente) se encontró que
**`trelloConfig.listId` nunca tuvo una migración registrada** en `src/migrations/index.ts`,
pese a existir en `Tenants.ts` desde `20260821_add_trello_workspace_fields`. Es la misma
clase de bug que el incidente P0 del 28-ago-2026 (schema drift), simplemente no había
producido un apagón visible todavía. Se cerró en la migración
`20260829_add_trello_byok_and_list_id_fix.ts` del mismo PR. Se documenta aquí porque es
exactamente el tipo de hallazgo que el test de paridad de migraciones
(`tests/int/migration-parity.test.ts`, PR de testing) está diseñado para atrapar en CI a
futuro.

---

## 1. Cola asíncrona para import de catálogo (CSV / Google Sheets) → ✅ **RESUELTO**

### Estado actual (implementado y verificado en `origin/main`)
- Se implementó la tarea `catalogImportRows` en `src/jobs/catalog-import.ts` utilizando la Jobs Queue oficial de Payload.
- Las rutas `import-csv` y `sync-sheets` procesan lotes de filas en background con dual-dispatch (`after()` para ejecución inmediata y reintentos vía GitHub Actions).
- Los productos y categorías se precargan en memoria en `Map` para resolver SKUs y nombres sin consultas N+1.

---

## 2. CSP enforce (salir de Report-Only) y SSL verificado a Supabase → 🟡 **PENDIENTE (CSP) / ✅ RESUELTO (SSL)**

### Estado actual (verificado en `next.config.mjs` y `src/payload.config.ts`)
- **SSL Supabase (RESUELTO):** `SUPABASE_CA_CERT` se encuentra configurado y activo en el entorno de producción en Vercel, permitiendo la verificación TLS estricta con Supabase.
- **CSP (PENDIENTE):** La directiva CSP se mantiene intencionalmente en `Content-Security-Policy-Report-Only` para evitar romper los scripts inline requeridos por el bootstrap del Admin Panel de Next.js/Payload. La transición a modo *enforce* requerirá pruebas exhaustivas en entornos preview y aprobación explícita del dueño del repositorio.

---

## 3. Autenticación de dos factores (2FA) → 🟡 **PENDIENTE (Decisión de Producto)**

### Estado actual (verificado)
- Tras auditar el historial completo de git, se confirmó que **2FA nunca fue implementado** en el código base.
- Se evaluaron tres opciones técnicas:
  1. Integración de plugin comunitario TOTP (`@clocklimited/payload-2fa`).
  2. Implementación de WebAuthn / Passkeys nativas.
  3. No implementarlo en esta etapa.
- **Decisión:** Mantener sin 2FA por el momento debido a la complejidad adicional vs. la cantidad reducida de usuarios con rol `super-admin`, privilegiando la estabilidad del panel de administración.

---

## 4. Nuevos hallazgos y correcciones (Ciclo Post-Migración Multi-Foto 2026-08-29)

### 4.1 Falso positivo en redirección de Google Sheets (SSRF check) → ✅ **RESUELTO (PR #52)**
- **Hallazgo:** Al intentar sincronizar hojas de Google Sheets públicas en `/api/[tenant]/sync-sheets`, el endpoint fallaba con el error *"La URL redirige fuera de Google Sheets y fue bloqueada por seguridad"*.
- **Causa Raíz:** Google Sheets exporta archivos mediante una redirección HTTP 307 hacia subdominios CDN de la forma `doc-XX-YY-sheets.googleusercontent.com`. La validación exigía estrictamente `finalHost === 'docs.google.com'`.
- **Solución:** Actualizada la validación para permitir hosts que coincidan con `/[.-]sheets\.googleusercontent\.com$/` o `.googleusercontent.com`, manteniendo el bloqueo contra destinos arbitrarios (SSRF).

### 4.2 URLs compuestas en `imageUrls` por el backfill de migración → ✅ **RESUELTO (PR #53)**
- **Hallazgo:** Tras la migración `20260829_products_image_urls.ts` a `hasMany: true`, productos con celdas previas de múltiples URLs separadas por comas (ej. `"url1, url2"`) quedaron guardados como un único string compuesto en `products_texts`. Al visualizarlos, la llamada a `new URL()` fallaba y el storefront mostraba imágenes rotas (ej. SKU `AUR-094` con 404 en Unsplash).
- **Solución:**
  1. Script de reparación `scripts/fix-broken-image-urls.ts` vía Payload Local API para dividir strings con comas y normalizar registros existentes.
  2. Hook `beforeValidate` y validación tolerante en `src/collections/Products.ts` para dividir automáticamente URLs compuestas pegadas en el admin.
  3. Componente `SafeProductImage` y manejadores `onError` en todos los temas visuales del storefront para renderizar la imagen de fallback ante URLs rotas o 404s externos.
  4. Actualización del enlace Unsplash de `AUR-094` en el catálogo semilla.

---

## Resumen de acción actualizado

| # | Tema | Estado |
|---|---|:---:|
| 1 | Cola async import catálogo | ✅ RESUELTO (Jobs Queue) |
| 2 | SSL Supabase CA Cert | ✅ RESUELTO (Configurado en Vercel) |
| 3 | CSP Enforce | 🟡 PENDIENTE (En Report-Only por seguridad) |
| 4 | 2FA Super-Admin | 🟡 PENDIENTE (Decisión de diseño) |
| 5 | Fix Google Sheets Redirect (PR #52) | ✅ RESUELTO |
| 6 | Fix Image URLs Split & Fallback (PR #53) | ✅ RESUELTO |

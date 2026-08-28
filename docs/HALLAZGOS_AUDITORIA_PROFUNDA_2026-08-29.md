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

## 1. Cola asíncrona para import de catálogo (CSV / Google Sheets)

### Estado actual (verificado)

- `src/app/api/[tenant]/import-csv/route.ts` y `sync-sheets/route.ts` corren **síncronos
  dentro del request** de Vercel. Ya no tienen el problema N+1 de queries (preload de
  productos/categorías en `Map`, ver `AUDITORIA_REVALIDADA_2026-08-25.md` §V-M3), pero
  siguen haciendo **1 `payload.create`/`payload.update` por fila, secuencial**. Con 5.000
  filas (el límite actual, `MAX_CSV_ROWS`) esto es un riesgo real de timeout de función
  serverless en Vercel, sobre todo en plan Hobby.
- El sistema **ya tiene** una Jobs Queue oficial de Payload en producción
  (`src/jobs/order-created.ts`, workflow `order-created`), con dual-dispatch (ejecución
  instantánea vía `after()` + reintento externo por GitHub Actions
  `.github/workflows/jobs-runner.yml`). Es la pieza de infraestructura correcta para este
  problema — **no hace falta sumar Inngest, QStash ni Vercel Queues.**

### Recomendación (sin implementar — requiere decisión de diseño del dueño)

Mover el import de catálogo a un **workflow nuevo de la misma Jobs Queue** (`catalog-import`),
en vez de procesarlo inline:

1. La ruta `import-csv`/`sync-sheets` valida el archivo, resuelve el `tenantId`, encola
   `payload.jobs.queue({ workflow: 'catalog-import', input: { tenantId, csvText o sheetUrl } })`
   y responde `202 Accepted` con el `job.id` de inmediato (patrón ya usado por el checkout
   para Trello/email, solo que aquí el trigger es un import en vez de un pedido).
2. El propio checkout ya dispara el job con `payload.jobs.runByID()` dentro de `after()`
   para procesamiento instantáneo en el caso feliz; el runner externo (GitHub Actions) lo
   reintenta si la función se cae a mitad de un catálogo grande — mismo patrón dual que ya
   existe, sin piezas nuevas.
3. El admin necesita una forma de ver el progreso: opción más simple sin nueva
   infraestructura — un campo `status`/`progress` en una colección ligera
   (`catalog-import-jobs`, o reusar el propio `payload-jobs` con su `output`) que el panel
   consulte por polling (ya hay precedente de polling ligero en el propio dashboard).
4. **Decisión pendiente del dueño:** ¿el import debe seguir respondiendo síncrono para
   catálogos pequeños (p. ej. <100 filas) y solo pasar a async por encima de un umbral? Eso
   evita cambiar la UX de "sincronizar y ver el resultado al instante" para el 90% de los
   comercios reales (que hoy están lejos de 5.000 SKUs, per `ROADMAP_V2.md`).

**Riesgo de no hacerlo:** ninguno inmediato — es un riesgo latente (comercios con catálogos
grandes), no un bug activo. No se prioriza para PR inmediato.

---

## 2. CSP enforce (salir de Report-Only) y SSL verificado a Supabase

### Estado actual (verificado en `next.config.mjs` y `src/payload.config.ts`)

- La CSP sigue en `Content-Security-Policy-Report-Only` con
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'` — es decir, **reporta pero no bloquea
  nada todavía**. Pasar a enforce con un `script-src` estricto (sin `unsafe-inline`)
  requeriría nonces por request, que Next.js App Router soporta oficialmente
  (`headers()` + middleware inyectando un nonce por respuesta), pero el admin de Payload usa
  un bootstrap inline que **hay que probar explícitamente que no se rompe** antes de
  habilitarlo en `enforce`.
- La conexión a Supabase sigue con:
  ```ts
  ssl: process.env.SUPABASE_CA_CERT
    ? { rejectUnauthorized: true, ca: ... }
    : { rejectUnauthorized: false }
  ```
  No se pudo verificar desde este entorno si `SUPABASE_CA_CERT` está cargado en las env vars
  de Vercel producción (requiere acceso al dashboard de Vercel, fuera del alcance de este
  ciclo). Si NO está cargado, la conexión sigue cifrada pero sin verificar la identidad del
  servidor (MITM teórico, no un problema activo conocido).

### Recomendación (sin implementar — dos alternativas a contrastar, per §1.4 de la constitución)

**Alternativa A — Nonces con middleware:** Next.js middleware genera un nonce por request,
lo inyecta en el header CSP y en cada `<script>` vía `next/script` con `nonce={nonce}`.
Riesgo: el bootstrap del admin de Payload usa scripts inline que Payload **no** expone un
punto oficial para inyectar nonces custom hoy (verificar contra la skill/Context7 antes de
intentarlo — puede no ser viable sin fork).

**Alternativa B — CSP enforce sin `script-src` (dejar que el default sea `default-src`) pero
con el resto de directivas (`frame-ancestors`, `object-src`, `form-action`) en modo
bloqueante:** menor cobertura contra XSS por script inline, pero cero riesgo de romper el
admin. Es la opción de menor esfuerzo/riesgo si no hay tiempo para probar nonces en preview.

**Paso 0 obligatorio antes de cualquiera de las dos:** confirmar en el dashboard de Vercel si
`SUPABASE_CA_CERT` ya está cargado (si no, cargarlo primero — cero riesgo, no requiere
código, solo pegar el certificado de Supabase Dashboard → Database Settings → SSL
Configuration en la env var de Vercel).

**Este punto requiere aprobación explícita del dueño antes de que cualquiera abra un PR**,
por su impacto directo en el flujo de login/admin de producción — probarlo primero en
preview con las dos alternativas antes de decidir cuál mergear.

---

## 3. Autenticación de dos factores (2FA)

### Estado actual (verificado)

- `src/collections/Users.ts` no tiene 2FA: solo email+password,
  `maxLoginAttempts: 5`/`lockTime: 10min`, `saveToJWT: true` en `role`.
- Payload **no tiene 2FA nativo en core** — confirmado contra el issue oficial
  `payloadcms/payload#2555` (abierto desde 2023, sin resolución de core al día de hoy). No es
  una limitación de esta app: es una brecha conocida y sin resolver del propio framework.
- La vía comunitaria más citada y activamente mantenida es
  [`@clocklimited/payload-2fa`](https://github.com/clocklimited/payload-2fa) (TOTP,
  compatible con `authStrategies` de Payload 3.x, con soporte i18n y opción
  `adminManageAccess` para que un super-admin pueda resetear el 2FA de otro usuario).

### Recomendación (sin implementar — requiere decisión de alcance del dueño)

1. **Alcance:** ¿obligatorio solo para `super-admin`, u opcional/obligatorio también para
   `tenant-admin`? Dado que un `tenant-admin` comprometido solo afecta a SU tienda (por el
   guard cross-tenant ya existente) mientras que un `super-admin` comprometido afecta a
   TODAS, la recomendación por defecto es: **obligatorio para super-admin, opcional para
   tenant-admin** (mismo criterio de riesgo que ya se usó para decidir `saveToJWT`/R4 en
   `PLAN_ROBUSTECIMIENTO_v2.md`).
2. **Antes de adoptar el plugin (FASE 0 de la constitución):** verificar en una rama aislada
   que `@clocklimited/payload-2fa` es compatible con `payload@3.88.0` exacto (el plugin
   documenta que debe ir **último** en el array de `plugins`, después de
   `multiTenantPlugin`/`seoPlugin` — orden a verificar contra la config real) y que no
   interfiere con `tokenExpiration: 7 días` ni con `saveToJWT: true` de `role`.
3. **Plan de rollback:** el plugin tiene `forceSetup` opcional (no forzar 2FA en el primer
   login de todos, para no bloquear al equipo mientras se prueba) y `disabled` (kill-switch
   por env var) — usar ambos en el despliegue inicial.

**Este punto requiere aprobación explícita del dueño antes de que cualquiera abra un PR**,
por su impacto directo en el flujo de login de todos los usuarios existentes.

---

## Resumen de acción

| # | Tema | Bloqueado por | Siguiente paso |
|---|---|---|---|
| 1 | Cola async import catálogo | Decisión de UX (¿umbral sync/async?) | Diseñar `catalog-import` workflow cuando el dueño confirme el umbral |
| 2 | CSP enforce + SSL Supabase | Riesgo de romper login/admin | Confirmar `SUPABASE_CA_CERT` en Vercel (bajo riesgo, ya mismo) + probar alternativa B en preview antes de A |
| 3 | 2FA | Riesgo de romper login/admin | Decidir alcance (solo super-admin vs también tenant-admin) antes de tocar código |

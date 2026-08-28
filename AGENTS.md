# AGENTS.md

SaaS e-commerce multi-tenant: Payload CMS 3.88 (Next.js 15.5 / React 19, App Router) + PostgreSQL en Supabase (Transaction Pooler 6543) + Vercel. Tiendas web responsive (mobile + desktop, NO PWA/instalable) en `flow.martes.app/[tenantSlug]`, admin en `/admin`, checkout a WhatsApp y despacho a Trello.

La **constitución del repo** está en `docs/AGENTS_CONSTITUTION.md` y se carga automáticamente. Leela siempre.

## Comandos
- Instalar: `pnpm install` (pnpm@10.27.0 — nunca npm/yarn)
- Dev: `pnpm dev` · Build: `pnpm build` (incluye typecheck de TS) · Lint: `pnpm lint` (`next lint`)
- Tipos de Payload: `pnpm generate:types` — regenéranos tras tocar `src/collections/*`
- Migraciones — ver sección **"Proceso de migraciones"** más abajo para el flujo completo obligatorio.

## Estructura
- `src/collections/` — esquemas Payload: Tenants, Users, Products, Categories, Orders, Customers, Media
- `src/payload.config.ts` — config maestro (plugins multi-tenant, seo, storage-s3/R2, email adapter multi-tenant, jobs, `push: false`, `prodMigrations`)
- `src/app/(payload)/` — admin + REST de Payload (`[...slug]/route.ts`)
- `src/app/(app)/[tenant]/` — storefront web responsive por comercio (ISR 300s; `revalidatePath`/`revalidateTag` en mutaciones)
- `src/app/actions/checkout.ts` — Server Action de checkout (Trello + PDF R2 + WhatsApp); guards anti-abuso al inicio (nonce → honeypot → rate-limit)
- `src/app/api/[tenant]/` y `src/app/api/orders/` — endpoints REST propios
- `src/lib/` — `trello.ts`, `pdf.ts`, `delivery-note.ts` (PDF→R2 + URLs firmadas), `exchange-rate.ts`, `analytics.ts` (agregaciones SQL), `email/` (adapter Resend multi-tenant), `checkout-nonce.ts` + `rate-limit.ts` + `checkout-guard.ts` (anti-abuso Sprint 5; rate-limit fail-open sobre Upstash)
- `src/jobs/` — Jobs Queue oficial (workflow `order-created`; runner externo GitHub Actions → `/api/payload-jobs/run`)
- `src/migrations/` — migraciones PostgreSQL de Payload

## Constraints
- NO editar `src/payload-types.ts` (generado) ni migraciones ya aplicadas; crear nuevas con `pnpm migrate:create`
- **PROHIBIDO escribir migraciones/DDL a mano**: Payload genera los nombres de columna por su conversión camelCase→snake_case (ej. `taskID`→`task_i_d`, `exchangeRateVES`→`exchange_rate_v_e_s`); SQL manual con otro nombre rompe las queries en runtime. Solo `migrate:create` + revisar el SQL generado.
- NO modificar `.env*` (ver `.env.example`); credenciales Trello/Resend/R2 son globales en Vercel
- NO ejecutar SQL crudo que salte hooks/validaciones de Payload; inventario usa `$inc` atómico oficial
- Aislamiento multi-tenant: filtrar por tenant salvo `super-admin`; el array `tenants` de users solo lo toca super-admin
- **Identidad git = la del dueño** (`AngelDelN <57774536+aikapenelope@users.noreply.github.com>`). Verificar con `git config user.email` antes de commitear; nunca correos de host (`@...MacBook-Pro...local`): Vercel marca como usuario externo y bloquea previews/deploys.
- **PROHIBIDO hacer merge de PRs ni push directo a `main`** — solo crear PRs; el merge lo hace el usuario.
- Build command de Vercel = `pnpm vercel-build`. NUNCA usar un script llamado `ci` (pnpm lo intercepta como comando built-in).

## Proceso de migraciones

### Regla de atomicidad (NO NEGOCIABLE — aprendida del schema drift de Ago 2026)
**Todo PR que modifique `src/collections/*.ts` (schema) DEBE incluir en el mismo PR:**
1. El archivo de migración en `src/migrations/YYYYMMDD_descripcion.ts`
2. El registro de esa migración en `src/migrations/index.ts`

**NUNCA** mergear cambios de schema sin su migración. Un deploy sin las columnas correspondientes produce un schema drift que bloquea a todos los tenants.

### Cómo funciona `prodMigrations` en este proyecto
```
Vercel deploy → Payload init → recorre prodMigrations[]
  → para cada migración:
      ¿nombre en payload_migrations (BD)? → SÍ: skip
                                           → NO: ejecuta up() → INSERT en payload_migrations
```
- `pnpm migrate:create` genera el archivo `.ts` con up()/down() — es **la única forma válida** de crear migraciones (ver constraint PROHIBIDO-DDL-manual).
- `pnpm migrate:create` **NO puede correr** en este entorno ni en Vercel (richtext-lexical ESM top-level await → `ERR_REQUIRE_ASYNC_MODULE`). Debe ejecutarse en un entorno local con la BD conectada.
- Si el archivo existe pero **no está en `index.ts`**, `prodMigrations` nunca lo ve → schema drift.

### Flujo normal (desarrollo local con BD conectada)
```bash
# 1. Editar src/collections/MiColeccion.ts
# 2. Generar la migración (necesita DATABASE_URI apuntando a la BD)
pnpm migrate:create
# 3. Revisar el SQL generado en src/migrations/YYYYMMDD_*.ts
# 4. El archivo YA está importado y registrado en src/migrations/index.ts (migrate:create lo hace)
# 5. pnpm generate:types  (actualizar payload-types.ts)
# 6. pnpm build && pnpm lint
# 7. Commit ATÓMICO: collections/ + migrations/ + payload-types.ts en el mismo commit
```

### Flujo de emergencia (schema drift activo en producción, vía Supabase MCP)
Cuando las columnas ya están en producción pero faltan en BD (o viceversa), usar el MCP de Supabase para reparar directamente por **conexión directa** (no pooler):

```sql
-- PASO 1: Aplicar el DDL faltante (usar nombres confirmados por los logs de error o por migrate:create local)
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "mi_columna" NUMERIC DEFAULT 0;

-- PASO 2: Registrar en payload_migrations (batch = MAX(batch) + 1)
INSERT INTO payload_migrations (name, batch)
VALUES ('YYYYMMDD_descripcion', <batch_siguiente>);
```

Luego commitear el archivo `.ts` de migración y el `index.ts` para mantener repo↔BD sincronizados. El próximo deploy en Vercel verá la migración en `payload_migrations` y la saltará (no la re-ejecutará).

**Nomenclatura de columnas** — Payload convierte camelCase a snake_case dividiendo en CADA mayúscula:
- `fixedPrice` → `fixed_price`
- `estimatedTime` → `estimated_time`
- `deliveryConfig` (grupo) + `fixedPrice` (campo) → `delivery_config_fixed_price`
- `taskID` → `task_i_d` (cada letra mayúscula = nuevo segmento)
- `exchangeRateVES` → `exchange_rate_v_e_s`
- Verificar siempre en los logs de error o con `migrate:create` antes de escribir SQL a mano.

## Proceso obligatorio por PR (aprendido de los fallos de Ago 2026)
- **Rebasar contra `main` antes de abrir el PR**: `git fetch origin && git rebase origin/main` — nunca entregar PR con base atrasada (genera conflictos).
- `pnpm build` local 0 errores ANTES de abrir el PR.
- Validar los patrones contra el entorno REAL antes de usarlos: plan de Vercel (Hobby: 1 cron/día), package manager (pnpm), versión de Node, naming generado por Payload. "Está en la doc" NO significa "funciona en este entorno": verificar el deploy.
- **Commit atómico de migraciones**: schema + archivo migración + index.ts en el mismo commit. Ver sección "Proceso de migraciones".

## Convenciones
- Alias de import: `@/*` → `./src/*`
- Next 15: `params`/`searchParams` SIEMPRE Promesas; Server Components sin hooks
- Runtime: Postgres por Pooler 6543; migraciones SIEMPRE por conexión directa, nunca por pooler
- Zonas horarias de fechas agregadas: SIEMPRE `America/Caracas` (UTC-4)

## Done when
- `pnpm build` compila (typecheck incluido) sin errores
- `pnpm generate:types` al día si cambiaste colecciones
- Migraciones generadas con `migrate:create` y revisadas a mano antes de aplicar; commits convencionales (`fix(scope):`, `refactor(scope):`)
- Rama rebasada contra `main`; PR abierto (nunca merge)
- **Deploy verificado**: preview/producción en Vercel en Ready (no solo build local)
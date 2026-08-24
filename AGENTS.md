# AGENTS.md

SaaS e-commerce multi-tenant: Payload CMS 3.88 (Next.js 15.5 / React 19, App Router) + PostgreSQL en Supabase (Transaction Pooler 6543) + Vercel. Tiendas PWA en `flow.martes.app/[tenantSlug]`, admin en `/admin`, checkout a WhatsApp y despacho a Trello.

La **constitución del repo** está en `docs/AGENTS_CONSTITUTION.md` y se carga automáticamente. Leela siempre.

## Comandos
- Instalar: `pnpm install` (pnpm@10.27.0 — nunca npm/yarn)
- Dev: `pnpm dev` · Build: `pnpm build` (incluye typecheck de TS) · Lint: `pnpm lint` (`next lint`)
- Tipos de Payload: `pnpm generate:types` — regenéranos tras tocar `src/collections/*`
- Migraciones: CREAR con `pnpm migrate:create` (única vía válida). APLICAR: automático en producción vía `prodMigrations` (init de Payload). El CLI `payload migrate` NO corre en serverless ni en este entorno (richtext-lexical es ESM con top-level await → ERR_REQUIRE_ASYNC_MODULE).

## Estructura
- `src/collections/` — esquemas Payload: Tenants, Users, Products, Categories, Orders, Customers, Media
- `src/payload.config.ts` — config maestro (plugins multi-tenant, seo, storage-s3/R2, email adapter multi-tenant, jobs, `push: false`, `prodMigrations`)
- `src/app/(payload)/` — admin + REST de Payload (`[...slug]/route.ts`)
- `src/app/(app)/[tenant]/` — storefront PWA por comercio (ISR 300s; `revalidatePath`/`revalidateTag` en mutaciones)
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

## Proceso obligatorio por PR (aprendido de los fallos de Ago 2026)
- **Rebasar contra `main` antes de abrir el PR**: `git fetch origin && git rebase origin/main` — nunca entregar PR con base atrasada (genera conflictos).
- `pnpm build` local 0 errores ANTES de abrir el PR.
- Validar los patrones contra el entorno REAL antes de usarlos: plan de Vercel (Hobby: 1 cron/día), package manager (pnpm), versión de Node, naming generado por Payload. "Está en la doc" NO significa "funciona en este entorno": verificar el deploy.
- Migraciones que toquen la BD de producción: aplicar por conexión directa (nunca pooler) y registrar en `payload_migrations`.

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
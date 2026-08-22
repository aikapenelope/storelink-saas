# AGENTS.md

SaaS e-commerce multi-tenant: Payload CMS 3.88 (Next.js 15.5 / React 19, App Router) + PostgreSQL en Supabase (Transaction Pooler 6543) + Vercel. Tiendas PWA en `flow.martes.app/[tenantSlug]`, admin en `/admin`, checkout a WhatsApp y despacho a Trello.

La **constitución del repo** está en `docs/AGENTS_CONSTITUTION.md` y se carga automáticamente. Leela siempre.

## Comandos
- Instalar: `pnpm install` (pnpm@10.27.0 — nunca npm/yarn)
- Dev: `pnpm dev` · Build: `pnpm build` (incluye typecheck de TS) · Lint: `pnpm lint` (`next lint`)
- Tipos de Payload: `pnpm generate:types` — regenéranos tras tocar `src/collections/*`
- Migraciones: crear con `pnpm migrate:create`, aplicar con `pnpm migrate`

## Estructura
- `src/collections/` — esquemas Payload: Tenants, Users, Products, Categories, Orders, Customers, Media
- `src/payload.config.ts` — config maestro (plugins multi-tenant, seo, storage-s3/R2, email-resend; `push: false`)
- `src/app/(payload)/` — admin + REST de Payload (`[...slug]/route.ts`)
- `src/app/(app)/[tenant]/` — storefront PWA por comercio (SSR dinámico; `middleware.ts` matcher excluye api/admin/estáticos)
- `src/app/actions/checkout.ts` — Server Action de checkout (Trello + PDF + WhatsApp)
- `src/app/api/[tenant]/` y `src/app/api/orders/` — endpoints REST propios
- `src/lib/` — `trello.ts`, `pdf.ts`, `exchange-rate.ts`, `order-token.ts`, `utils.ts`
- `src/migrations/` — migraciones PostgreSQL de Payload

## Constraints
- NO editar `src/payload-types.ts` (generado) ni migraciones ya aplicadas; crear nuevas con `pnpm migrate:create`
- NO modificar `.env*` (ver `.env.example`); credenciales Trello/Resend/R2 son globales en Vercel
- NO ejecutar SQL crudo que salte hooks/validaciones de Payload; inventario usa `$inc` atómico oficial
- Aislamiento multi-tenant: filtrar por tenant salvo `super-admin`; el array `tenants` de users solo lo toca super-admin

## Convenciones
- Alias de import: `@/*` → `./src/*`
- Next 15: `params`/`searchParams` SIEMPRE Promesas; Server Components sin hooks
- Runtime: Postgres por Pooler 6543; migraciones SIEMPRE por conexión directa, nunca por pooler

## Done when
- `pnpm lint` sin errores y `pnpm build` compila
- `pnpm generate:types` al día si cambiaste colecciones
- Migraciones nuevas revisadas a mano antes de aplicar; commits convencionales (`fix(scope):`, `refactor(scope):`)
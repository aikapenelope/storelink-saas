import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * PR 6a (SPEC-20260907-6): valor nuevo del enum `enum_payload_jobs_task_slug`
 * para el task `reconcileDispatchOrders` (sweep de reconciliación de
 * despachos, schedule cada 30 min).
 *
 * DDL idéntico al que Payload genera con `migrate:create` al registrar un
 * task nuevo (verificado contra la BD de test: el push de drizzle crea el
 * enum con los slugs de config.jobs.tasks; en producción el ALTER TYPE ADD
 * VALUE es la forma canónica de extenderlo). ADD VALUE es aditivo y no
 * bloquea; el valor se usa a partir del deploy que registra el task.
 *
 * Nota: `ALTER TYPE ... ADD VALUE` NO puede correr dentro de una transacción
 * con el tipo en uso en la misma tx en Postgres <12; en PG 12+ (Supabase es
 * 15+) es seguro. Payload ejecuta migraciones en tx por defecto: si el
 * runner fallara con "cannot alter type ... because it is already in use",
 * el fallback documentado es ejecutarlo manualmente por conexión directa.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_payload_jobs_task_slug" ADD VALUE IF NOT EXISTS 'reconcileDispatchOrders';
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres no soporta REMOVE VALUE en enums: el down es no-op documentado
  // (el valor queda huérfano pero inerte si el task se retira del config).
  // eslint-disable-next-line no-console
  console.warn(
    '[migration 20260908_jobs_reconcile_task_slug] down(): ALTER TYPE DROP VALUE no existe en Postgres; el valor reconcileDispatchOrders permanece en el enum (inerte sin el task registrado).'
  );
}

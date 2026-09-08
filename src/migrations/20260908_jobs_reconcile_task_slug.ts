import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * PR 6 (SPEC-20260907-6) — review Devin #96 hallazgo 1.
 *
 * HISTORIA: la primera versión de esta migración hacía
 * `ALTER TYPE enum_payload_jobs_task_slug ADD VALUE 'reconcileDispatchOrders'`
 * — pero PRODUCCIÓN no tiene ese enum: la migración 20260822_jobs_queue
 * creó `payload_jobs.task_slug` como VARCHAR (solo la tabla hija
 * payload_jobs_log tiene enums de task_slug en BDs nuevas). El ALTER TYPE
 * habría fallado en el primer deploy y bloqueado la plataforma entera.
 *
 * VERIFICADO en producción (Supabase, 2026-09-08):
 *   payload_jobs.task_slug → character varying (varchar)
 *
 * CONCLUSIÓN: registrar el task `reconcileDispatchOrders` en
 * config.jobs.tasks NO requiere NINGÚN cambio de BD en producción — la
 * columna varchar acepta el slug nuevo. Esta migración queda como no-op
 * documentado (la fila en payload_migrations marca el punto de registro).
 * En BDs pusheadas por drizzle (test/local) el enum de la tabla HIJA
 * (payload_jobs_log) se regenera con el valor nuevo automáticamente vía
 * push:true — tampoco requiere ALTER (verificado en la BD de test).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // No-op intencional: la columna task_slug de payload_jobs es varchar en
  // producción (migración 20260822) y acepta el slug del task nuevo sin DDL.
  // El SELECT solo documenta-verifica que la tabla existe (falla ruidoso si
  // el esquema de jobs no está aplicado).
  await db.execute(sql`SELECT 1 FROM "payload_jobs" LIMIT 1`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // No-op simétrico: nada que revertir (la columna varchar ya aceptaba el
  // valor; retirar el task del config es suficiente).
  await db.execute(sql`SELECT 1`);
}

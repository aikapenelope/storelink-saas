import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * F1 (auditoría BYOK 2026-08-29): resend-tenant-adapter.ts resuelve la clave
 * BYOK de Resend por `emailConfig.fromEmail` (no por tenant.id). Sin una
 * restricción real en BD, dos tenants con el mismo fromEmail hacían que el
 * adapter le prestara silenciosamente la clave de Resend de un tenant a
 * otro — el `validate` agregado en Tenants.ts da el error amigable en el
 * admin, pero solo esta migración cierra la condición de carrera entre dos
 * guardados simultáneos (el validate por sí solo no es atómico).
 *
 * Índice ÚNICO PARCIAL (no unique:true de Payload, que generaría un
 * constraint no-parcial): se excluyen explícitamente NULL y '' porque la
 * gran mayoría de tenants deja este campo vacío (usa la clave global) y no
 * deben colisionar entre sí. Mismo patrón de índice único ya usado en
 * customers_tenant_phone_unique / categories_tenant_slug_unique.
 *
 * IMPORTANTE antes de aplicar en producción: correr primero
 *   SELECT email_config_from_email, COUNT(*) FROM tenants
 *   WHERE email_config_from_email IS NOT NULL AND email_config_from_email <> ''
 *   GROUP BY 1 HAVING COUNT(*) > 1;
 * Si devuelve filas, resolver la colisión real (rotar el fromEmail de uno de
 * los tenants) ANTES de aplicar — de lo contrario esta migración falla con
 * un error 23505 de Postgres (falla segura, no aplica a medias).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "tenants_email_config_from_email_unique"
      ON "tenants" ("email_config_from_email")
      WHERE "email_config_from_email" IS NOT NULL AND "email_config_from_email" <> '';
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "tenants_email_config_from_email_unique";
  `);
}

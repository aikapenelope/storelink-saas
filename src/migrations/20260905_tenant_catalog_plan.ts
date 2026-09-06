import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Campo `plan` en tenants (planes de capacidad del catálogo).
 *
 * Auditoría 2026-09-05 (P1-1): el límite de catálogo por tienda pasa de un
 * 500 hardcodeado a un límite configurable por super-admin vía el campo
 * `plan` (select: 'basico' → 500, 'pro' → 2000). Sin plan (NULL) la tienda
 * usa el límite estándar de 1000 productos — la fuente de verdad de los
 * números es src/lib/tenant-plans.ts, aquí solo existe la columna.
 *
 * DDL idéntico al que Payload genera para un campo select en esta tabla
 * (ver migración 20260819: `theme VARCHAR`). Columna nullable, aditiva,
 * sin valor por defecto (la constitución prohíbe NOT NULL sin default).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "plan" VARCHAR;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "plan";
  `);
}

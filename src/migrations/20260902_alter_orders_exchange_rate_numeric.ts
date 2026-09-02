import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Sprint 2 (Auditoría Vector 2 / Hallazgo #4):
 * Precisión decimal en órdenes para exchange_rate_v_e_s.
 *
 * Contexto: la migración 20260821_2_order_uniqueness_rate_snapshot creó
 * `exchange_rate_v_e_s` como `double precision` (coma flotante binaria IEEE 754).
 * Las operaciones financieras y analíticas sobre divisas requieren coma fija
 * decimal (`numeric(12, 4)`) para evitar errores de redondeo o desajustes de
 * céntimos en agregaciones SQL (src/lib/analytics.ts).
 *
 * Esta migración altera el tipo de dato de forma segura y no destructiva,
 * preservando los valores existentes con `USING ...::numeric(12, 4)`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders"
      ALTER COLUMN "exchange_rate_v_e_s" TYPE numeric(12, 4)
      USING "exchange_rate_v_e_s"::numeric(12, 4);
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders"
      ALTER COLUMN "exchange_rate_v_e_s" TYPE double precision
      USING "exchange_rate_v_e_s"::double precision;
  `);
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Sprint 2 (Auditoría Vector 2 / Hallazgo #4):
 * Precisión decimal en órdenes para exchange_rate_v_e_s.
 *
 * Invariante de arquitectura (docs/AGENTS_CONSTITUTION.md & AGENTS.md):
 * "Runtime: conexiones vía Transaction Pooler puerto 6543.
 *  Migraciones: ejecutar SIEMPRE por conexión directa, NUNCA por pooler."
 *
 * Para asegurar que el startup de Payload en Vercel jamás intente ejecutar DDL
 * (ALTER COLUMN TYPE) a través del Transaction Pooler (puerto 6543):
 * 1. Idempotencia: si la columna ya fue migrada a numeric(12, 4) por conexión directa,
 *    se omite el DDL (no-op seguro).
 * 2. Guardia de seguridad: si la columna está pendiente y la conexión activa apunta
 *    al pooler de transacciones (puerto 6543), se bloquea la ejecución para impedir
 *    que PgBouncer reciba DDL bloqueante.
 * 3. Conexión directa (puerto 5432 / local / CI): ejecuta la alteración atómica.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Idempotencia: Verificar si la columna ya tiene el tipo exacto numeric(12, 4)
  const check = await db.execute(sql`
    SELECT data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'exchange_rate_v_e_s';
  `);
  const col = (check as unknown as { rows?: Array<{ data_type?: string; numeric_precision?: number; numeric_scale?: number }> })?.rows?.[0];

  if (col?.data_type === 'numeric' && Number(col?.numeric_precision) === 12 && Number(col?.numeric_scale) === 4) {
    // Ya aplicada en Supabase por conexión directa antes del deploy. No-op seguro.
    return;
  }

  // 2. Guardia de seguridad para Transaction Pooler (puerto 6543)
  const connStr = process.env.DATABASE_URI || process.env.POSTGRES_URL || '';
  const isTransactionPooler = connStr.includes(':6543') || connStr.includes('pooler.supabase.com');

  if (isTransactionPooler) {
    throw new Error(
      '[BLOCKED_TRANSACTION_POOLER_DDL] La migración "20260902_alter_orders_exchange_rate_numeric" contiene DDL (ALTER COLUMN TYPE) y no puede ejecutarse a través del Transaction Pooler de Supabase (puerto 6543). Debe aplicarse mediante conexión directa (puerto 5432 o Supabase SQL Editor) y registrarse en payload_migrations antes de desplegar en Vercel. Ver docs/AGENTS_CONSTITUTION.md.'
    );
  }

  // 3. Conexión directa (puerto 5432 / CI / local):
  await db.execute(sql`
    ALTER TABLE "orders"
      ALTER COLUMN "exchange_rate_v_e_s" TYPE numeric(12, 4)
      USING "exchange_rate_v_e_s"::numeric(12, 4);
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const connStr = process.env.DATABASE_URI || process.env.POSTGRES_URL || '';
  const isTransactionPooler = connStr.includes(':6543') || connStr.includes('pooler.supabase.com');

  if (isTransactionPooler) {
    throw new Error(
      '[BLOCKED_TRANSACTION_POOLER_DDL] El rollback de DDL no puede ejecutarse a través del Transaction Pooler de Supabase (puerto 6543).'
    );
  }

  await db.execute(sql`
    ALTER TABLE "orders"
      ALTER COLUMN "exchange_rate_v_e_s" TYPE double precision
      USING "exchange_rate_v_e_s"::double precision;
  `);
}

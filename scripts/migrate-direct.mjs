import pg from 'pg';
const { Client } = pg;

/**
 * Script de migración por conexión directa a Supabase (puerto 5432).
 * 
 * Cumple con la directiva constitucional de AGENTS.md:
 * "Migraciones: ejecutar SIEMPRE por conexión directa, NUNCA por pooler (puerto 6543)."
 * 
 * Lee DATABASE_DIRECT_URL, DIRECT_URL o DATABASE_URI con puerto 5432.
 * Ejecuta el DDL y registra la migración en payload_migrations de forma atómica.
 */
async function runDirectMigration() {
  const directUrl =
    process.env.DATABASE_DIRECT_URL ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URI?.replace(':6543', ':5432');

  if (!directUrl) {
    console.error('❌ ERROR: Debe definir DATABASE_DIRECT_URL o DIRECT_URL con la cadena de conexión directa (puerto 5432).');
    process.exit(1);
  }

  if (directUrl.includes(':6543')) {
    console.error('❌ ERROR: La URL proporcionada apunta al Transaction Pooler (puerto 6543). Las migraciones DDL requieren conexión directa (puerto 5432).');
    process.exit(1);
  }

  console.log('🔌 Conectando a Supabase / PostgreSQL por conexión directa...');
  const client = new Client({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    console.log('🚀 Iniciando migración 20260902_alter_orders_exchange_rate_numeric...');
    await client.query('BEGIN');

    // 1. Ejecutar DDL
    await client.query(`
      ALTER TABLE "orders"
        ALTER COLUMN "exchange_rate_v_e_s" TYPE numeric(12, 4)
        USING "exchange_rate_v_e_s"::numeric(12, 4);
    `);
    console.log('✅ orders.exchange_rate_v_e_s convertida exitosamente a numeric(12, 4).');

    // 2. Registrar en payload_migrations
    const migrationName = '20260902_alter_orders_exchange_rate_numeric';
    const batchRes = await client.query(`
      SELECT COALESCE(MAX(batch), 0) + 1 AS next_batch FROM payload_migrations;
    `);
    const nextBatch = batchRes.rows[0]?.next_batch || 1;

    await client.query(`
      INSERT INTO payload_migrations (name, batch)
      SELECT $1, $2
      WHERE NOT EXISTS (
        SELECT 1 FROM payload_migrations WHERE name = $1
      );
    `, [migrationName, nextBatch]);
    console.log(`✅ Migración "${migrationName}" registrada en payload_migrations (batch ${nextBatch}).`);

    await client.query('COMMIT');
    console.log('🎉 Migración directa finalizada con éxito. El startup de Vercel la saltará de forma segura.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ERROR ejecutando la migración directa:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runDirectMigration();

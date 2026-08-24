import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

// Índice ÚNICO compuesto (tenant_id, phone) en customers: cierra la carrera
// del upsert del CRM en checkout.ts (dos checkouts simultáneos con el mismo
// teléfono creaban clientes duplicados). Payload no expone compound uniques
// en config; la violación PG 23505 la traduce drizzle automáticamente a
// ValidationError "Value must be unique" (handleUpsertError).
// Columnas 'tenant_id' y 'phone': palabras únicas minúsculas, sin naming trap.
// Duplicados detectados previo a aplicar: 0 (query de detección en el PR #33).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "customers_tenant_phone_unique" ON "customers" ("tenant_id", "phone");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "customers_tenant_phone_unique";
  `);
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

// Migración de endurecimiento de seguridad y optimización de rendimiento:
// 1. Activa RLS en payload_jobs y payload_jobs_log para proteger la exposición anónima en PostgREST.
// 2. Crea índices cubridores en llaves foráneas de meta_image_id en products y tenants.
// 3. Elimina índice redundante tenants_slug_idx (ya cubierto por tenants_slug_unique).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE IF EXISTS "payload_jobs" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS "payload_jobs_log" ENABLE ROW LEVEL SECURITY;

    CREATE INDEX IF NOT EXISTS "products_meta_image_id_idx" ON "products" ("meta_image_id");
    CREATE INDEX IF NOT EXISTS "tenants_meta_image_id_idx" ON "tenants" ("meta_image_id");

    DROP INDEX IF EXISTS "tenants_slug_idx";
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE IF EXISTS "payload_jobs" DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS "payload_jobs_log" DISABLE ROW LEVEL SECURITY;

    DROP INDEX IF EXISTS "products_meta_image_id_idx";
    DROP INDEX IF EXISTS "tenants_meta_image_id_idx";

    CREATE INDEX IF NOT EXISTS "tenants_slug_idx" ON "tenants" ("slug");
  `);
}

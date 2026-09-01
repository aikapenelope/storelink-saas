import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Unique constraint en trelloConfig.listId para prevenir mezcla de pedidos
 * entre tenants. Si dos comercios configuran el mismo listId por error humano,
 * los pedidos caerían en la misma lista de Trello, rompiendo el aislamiento
 * multi-tenant.
 *
 * Esta migración usa EXCLUDE constraint de PostgreSQL que permite NULL
 * (comercios sin Trello configurado) pero asegura unicidad para valores no nulos.
 * Si un listId ya está duplicado en producción, esta migración fallará
 * intencionalmente forzando a resolver el conflicto manualmente.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      ADD CONSTRAINT "trello_list_id_unique" 
      EXCLUDE ("trello_config_list_id" WITH =);
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      DROP CONSTRAINT IF EXISTS "trello_list_id_unique";
  `);
}

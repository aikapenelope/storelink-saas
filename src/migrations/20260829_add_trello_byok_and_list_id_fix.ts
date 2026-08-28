import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Dos cambios en esta migración, agrupados porque tocan el mismo grupo
 * (Tenants.trelloConfig) y el mismo archivo de colección:
 *
 * 1. FIX de drift preexistente (hallado en auditoría, no introducido por este
 *    cambio): `trelloConfig.listId` existe en Tenants.ts desde
 *    20260821_add_trello_workspace_fields (ver GUIA_GESTION_FLOW.md paso 4 y
 *    src/jobs/order-created.ts) pero NINGUNA migración registrada en
 *    src/migrations/index.ts agregó jamás la columna
 *    "trello_config_list_id". Es la misma clase de bug que el incidente P0
 *    del 28-ago-2026 (columna de colección sin migración) — aquí se cierra
 *    antes de que produzca el mismo apagón. `ADD COLUMN IF NOT EXISTS` es
 *    seguro de aplicar sin importar si la columna ya existe en producción
 *    (por ejemplo, si alguna vez se agregó a mano vía Supabase directo sin
 *    commitear la migración de vuelta, per el "Flujo de emergencia" de
 *    docs/AGENTS_CONSTITUTION.md §4).
 * 2. BYOK Trello por tenant (mismo patrón que email_config_resend_api_key en
 *    20260819_add_theme_emailconfig_variants_modifiers): columnas write-only
 *    para que un comercio avanzado use su propia cuenta de Trello en vez de
 *    la credencial maestra global.
 *
 * Nomenclatura verificada contra el patrón camelCase→snake_case ya usado en
 * el resto de trelloConfig (trello_config_enabled, trello_config_board_url):
 * listId -> trello_config_list_id, apiKey -> trello_config_api_key,
 * token -> trello_config_token.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "trello_config_list_id" VARCHAR,
      ADD COLUMN IF NOT EXISTS "trello_config_api_key" VARCHAR,
      ADD COLUMN IF NOT EXISTS "trello_config_token" VARCHAR;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "trello_config_api_key",
      DROP COLUMN IF EXISTS "trello_config_token",
      DROP COLUMN IF EXISTS "trello_config_list_id";
  `);
}

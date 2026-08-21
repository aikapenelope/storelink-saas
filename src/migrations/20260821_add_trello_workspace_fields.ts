import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants" 
      ADD COLUMN IF NOT EXISTS "trello_config_enabled" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "trello_config_workspace_name" varchar,
      ADD COLUMN IF NOT EXISTS "trello_config_board_name" varchar,
      ADD COLUMN IF NOT EXISTS "trello_config_board_url" varchar;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants" 
      DROP COLUMN IF EXISTS "trello_config_enabled",
      DROP COLUMN IF EXISTS "trello_config_workspace_name",
      DROP COLUMN IF EXISTS "trello_config_board_name",
      DROP COLUMN IF EXISTS "trello_config_board_url";
  `);
}

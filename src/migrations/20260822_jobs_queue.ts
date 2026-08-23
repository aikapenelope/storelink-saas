import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

// Jobs Queue oficial de Payload 3 (docs/jobs-queue): colección interna
// payload-jobs (trabajos pendientes del workflow `order-created`) con su
// array `log` en la tabla hija payload_jobs_log.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "payload_jobs" (
      "id" SERIAL PRIMARY KEY,
      "input" jsonb,
      "completed_at" timestamp(3) with time zone,
      "total_tried" numeric DEFAULT 0,
      "has_error" boolean DEFAULT false,
      "error" jsonb,
      "workflow_slug" varchar,
      "task_slug" varchar,
      "queue" varchar DEFAULT 'default',
      "wait_until" timestamp(3) with time zone,
      "processing" boolean DEFAULT false,
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS "payload_jobs_created_at_idx" ON "payload_jobs" ("created_at");
    CREATE INDEX IF NOT EXISTS "payload_jobs_total_tried_idx" ON "payload_jobs" ("total_tried");
    CREATE INDEX IF NOT EXISTS "payload_jobs_has_error_idx" ON "payload_jobs" ("has_error");
    CREATE INDEX IF NOT EXISTS "payload_jobs_workflow_slug_idx" ON "payload_jobs" ("workflow_slug");
    CREATE INDEX IF NOT EXISTS "payload_jobs_task_slug_idx" ON "payload_jobs" ("task_slug");
    CREATE INDEX IF NOT EXISTS "payload_jobs_queue_idx" ON "payload_jobs" ("queue");
    CREATE INDEX IF NOT EXISTS "payload_jobs_wait_until_idx" ON "payload_jobs" ("wait_until");
    CREATE INDEX IF NOT EXISTS "payload_jobs_processing_idx" ON "payload_jobs" ("processing");

    CREATE TABLE IF NOT EXISTS "payload_jobs_log" (
      "id" varchar PRIMARY KEY,
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL REFERENCES "payload_jobs"("id") ON DELETE CASCADE,
      "executed_at" timestamp(3) with time zone NOT NULL,
      "completed_at" timestamp(3) with time zone NOT NULL,
      "task_slug" varchar NOT NULL,
      "task_i_d" varchar NOT NULL,
      "input" jsonb,
      "output" jsonb,
      "state" varchar NOT NULL,
      "error" jsonb
    );

    CREATE INDEX IF NOT EXISTS "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "payload_jobs_log_order_idx" ON "payload_jobs_log" ("_order");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_jobs_log_parent_id_idx";
    DROP INDEX IF EXISTS "payload_jobs_log_order_idx";
    DROP TABLE IF EXISTS "payload_jobs_log";
    DROP INDEX IF EXISTS "payload_jobs_created_at_idx";
    DROP INDEX IF EXISTS "payload_jobs_total_tried_idx";
    DROP INDEX IF EXISTS "payload_jobs_has_error_idx";
    DROP INDEX IF EXISTS "payload_jobs_workflow_slug_idx";
    DROP INDEX IF EXISTS "payload_jobs_task_slug_idx";
    DROP INDEX IF EXISTS "payload_jobs_queue_idx";
    DROP INDEX IF EXISTS "payload_jobs_wait_until_idx";
    DROP INDEX IF EXISTS "payload_jobs_processing_idx";
    DROP TABLE IF EXISTS "payload_jobs";
  `);
}
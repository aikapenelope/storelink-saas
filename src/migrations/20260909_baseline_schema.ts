import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * PR 3.2 (plan sprints 2026-09-09, V5): BASELINE reproducible — la cadena
 * de migraciones arranca desde BD VACÍA (gap DR hallazgo 24 de la auditoría
 * 09-04: la primera migración era ALTER sobre tablas asumidas preexistentes,
 * chainHasBaseline() falso → BDs nuevas/restauradas no podían reconstruir).
 *
 * GENERACIÓN: up()/down() generados 100% por el core vía payload.db.
 * createMigration (misma API que `payload migrate:create`, que no corre en
 * este repo por ERR_REQUIRE_ASYNC_MODULE — AGENTS.md), difeando el schema
 * runtime de la config REAL contra el snapshot default (sin .json previo).
 * Revisión manual (constitución §4): 28 CREATE TABLE verificadas contra el
 * schema de referencia de la BD de test (diff 28/28 idénticas), enums
 * completos, FKs e índices incluidos. Su snapshot .json acompaña este
 * archivo — el próximo createMigration difea contra ÉL, no contra default.
 *
 * IDEMPOTENCIA DE ARRANQUE (producción = no-op): prodMigrations corre en el
 * arranque de cada deploy. Producción ya tiene TODO el schema aplicado →
 * early-return si `tenants` ya existe (mismo patrón de detección de
 * 20260908_rls_customers_tables). BDs NUEVAS/RESTAURADAS: la tabla no
 * existe → corre el CREATE completo y las migraciones siguientes aplican
 * sus ALTERs/índices/backfills normalmente sobre él.
 *
 * GUARDIA ANTI-POOLER: DDL masivo — jamás por Transaction Pooler (6543).
 *
 * El down() (DROP de todo el schema) existe por simetría del generador:
 * SOLO es útil en BDs de test/paridad — jamás correr en producción.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Idempotencia de arranque: producción (y cualquier BD ya migrada)
  //    tiene `tenants` → no-op. El registro en payload_migrations lo hace
  //    el flujo normal de prodMigrations al primer arranque.
  const check = await db.execute(sql`
    SELECT count(*) AS existing FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenants'
  `);
  const row = (check as unknown as { rows?: Array<{ existing?: string | number }> })?.rows?.[0];
  if (Number(row?.existing) > 0) {
    return;
  }

  // 2. Guardia anti-pooler: DDL masivo pendiente + pooler → bloquear.
  const connStr = process.env.DATABASE_URI || process.env.POSTGRES_URL || '';
  if (connStr.includes(':6543') || connStr.includes('pooler.supabase.com')) {
    throw new Error(
      '[BLOCKED_TRANSACTION_POOLER_DDL] La migración "20260909_baseline_schema" contiene DDL masivo (CREATE del schema completo) pendiente y no puede ejecutarse a través del Transaction Pooler de Supabase (puerto 6543). Para una BD restaurada/nueva: aplicar por conexión directa (puerto 5432 o Supabase SQL Editor) y registrar la fila en payload_migrations ANTES del deploy. En producción el schema ya existe y esta migración corre como no-op. Ver docs/AGENTS_CONSTITUTION.md §Migraciones.'
    );
  }

  // 3. Conexión directa (BD vacía): CREATE completo generado por el core.
  await db.execute(sql`
   CREATE TYPE "public"."enum_tenants_theme" AS ENUM('basic-banner', 'food-delivery', 'fashion-boutique', 'moto-parts', 'hardware-store', 'b2b-matrix', 'editorial', 'fluid-pwa', 'vercel-commerce');
  CREATE TYPE "public"."enum_tenants_plan" AS ENUM('basico', 'pro');
  CREATE TYPE "public"."enum_tenants_branding_currency" AS ENUM('USD', 'EUR', 'MXN', 'COP');
  CREATE TYPE "public"."enum_users_role" AS ENUM('super-admin', 'tenant-admin');
  CREATE TYPE "public"."enum_products_variants_stock_status" AS ENUM('in_stock', 'out_of_stock');
  CREATE TYPE "public"."enum_products_stock_status" AS ENUM('in_stock', 'out_of_stock');
  CREATE TYPE "public"."enum_orders_status" AS ENUM('pending', 'confirmed', 'preparing', 'in_delivery', 'delivered', 'cancelled');
  CREATE TYPE "public"."enum_orders_delivery_type" AS ENUM('delivery', 'pickup');
  CREATE TYPE "public"."enum_orders_payment_details_method_key" AS ENUM('pago_movil', 'zelle', 'binance', 'zinli', 'banesco_panama', 'cash', 'pos');
  CREATE TYPE "public"."enum_orders_payment_details_payment_status" AS ENUM('pending_verification', 'verified', 'rejected');
  CREATE TYPE "public"."enum_customers_purchase_history_delivery_type" AS ENUM('delivery', 'pickup');
  CREATE TYPE "public"."enum_customers_tag" AS ENUM('nuevo', 'frecuente', 'vip', 'inactivo');
  CREATE TYPE "public"."enum_customers_preferences_preferred_delivery_type" AS ENUM('delivery', 'pickup', 'none');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'trelloDispatchOrder', 'sendOrderConfirmationEmail', 'catalogImportRows', 'reconcileDispatchOrders');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_workflow_slug" AS ENUM('order-created');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'trelloDispatchOrder', 'sendOrderConfirmationEmail', 'catalogImportRows', 'reconcileDispatchOrders');
  CREATE TABLE "tenants_delivery_config_zones" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price_delivery" numeric DEFAULT 0,
  	"estimated_time" varchar
  );
  
  CREATE TABLE "tenants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"theme" "enum_tenants_theme" DEFAULT 'basic-banner',
  	"plan" "enum_tenants_plan",
  	"whatsapp_phone" varchar NOT NULL,
  	"email_config_enabled" boolean DEFAULT true,
  	"email_config_resend_api_key" varchar,
  	"email_config_from_email" varchar,
  	"email_config_notification_email" varchar,
  	"email_config_email_subject" varchar DEFAULT '🛍️ Confirmación y Comprobante de tu Pedido',
  	"trello_config_enabled" boolean DEFAULT true,
  	"trello_config_workspace_name" varchar,
  	"trello_config_board_name" varchar,
  	"trello_config_board_url" varchar,
  	"trello_config_list_id" varchar,
  	"trello_config_api_key" varchar,
  	"trello_config_token" varchar,
  	"branding_logo_id" integer,
  	"branding_currency" "enum_tenants_branding_currency" DEFAULT 'USD',
  	"branding_show_v_e_s" boolean DEFAULT true,
  	"branding_exchange_rate_v_e_s" numeric,
  	"branding_primary_color" varchar DEFAULT '#1e293b',
  	"branding_welcome_message" varchar DEFAULT '¡Bienvenido a nuestro catálogo! Haz tu pedido y lo recibirás directo por WhatsApp.',
  	"pickup_config_enabled" boolean DEFAULT true,
  	"pickup_config_location_address" varchar,
  	"pickup_config_schedule" varchar,
  	"pickup_config_estimated_time" varchar,
  	"pickup_config_instructions" varchar,
  	"payment_methods_config_pago_movil_enabled" boolean DEFAULT true,
  	"payment_methods_config_pago_movil_bank" varchar,
  	"payment_methods_config_pago_movil_phone" varchar,
  	"payment_methods_config_pago_movil_id_doc" varchar,
  	"payment_methods_config_pago_movil_account_holder" varchar,
  	"payment_methods_config_zelle_enabled" boolean DEFAULT false,
  	"payment_methods_config_zelle_email" varchar,
  	"payment_methods_config_zelle_account_holder" varchar,
  	"payment_methods_config_binance_enabled" boolean DEFAULT false,
  	"payment_methods_config_binance_pay_id" varchar,
  	"payment_methods_config_binance_nickname" varchar,
  	"payment_methods_config_zinli_enabled" boolean DEFAULT false,
  	"payment_methods_config_zinli_email" varchar,
  	"payment_methods_config_zinli_account_holder" varchar,
  	"payment_methods_config_banesco_panama_enabled" boolean DEFAULT false,
  	"payment_methods_config_banesco_panama_account_number" varchar,
  	"payment_methods_config_banesco_panama_account_holder" varchar,
  	"payment_methods_config_banesco_panama_account_type" varchar,
  	"payment_methods_config_cash_enabled" boolean DEFAULT true,
  	"payment_methods_config_cash_instructions" varchar,
  	"payment_methods_config_pos_enabled" boolean DEFAULT true,
  	"payment_methods_config_pos_instructions" varchar,
  	"delivery_config_fixed_price" numeric DEFAULT 0,
  	"delivery_config_estimated_time" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_tenants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "enum_users_role" DEFAULT 'tenant-admin' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer
  );
  
  CREATE TABLE "products_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"sku" varchar,
  	"price" numeric NOT NULL,
  	"stock_quantity" numeric,
  	"stock_status" "enum_products_variants_stock_status" DEFAULT 'in_stock'
  );
  
  CREATE TABLE "products_modifiers_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price_delta" numeric DEFAULT 0
  );
  
  CREATE TABLE "products_modifiers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"group_name" varchar NOT NULL,
  	"required" boolean DEFAULT false
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"title" varchar NOT NULL,
  	"sku" varchar NOT NULL,
  	"price" numeric NOT NULL,
  	"description" varchar,
  	"category_id" integer,
  	"stock_status" "enum_products_stock_status" DEFAULT 'in_stock',
  	"track_stock" boolean DEFAULT false,
  	"stock_quantity" numeric,
  	"featured" boolean DEFAULT false,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "orders_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"sku" varchar,
  	"title" varchar NOT NULL,
  	"price" numeric NOT NULL,
  	"quantity" numeric NOT NULL,
  	"subtotal" numeric
  );
  
  CREATE TABLE "orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"order_number" varchar NOT NULL,
  	"exchange_rate_v_e_s" numeric,
  	"status" "enum_orders_status" DEFAULT 'pending' NOT NULL,
  	"customer_name" varchar NOT NULL,
  	"customer_phone" varchar NOT NULL,
  	"customer_email" varchar NOT NULL,
  	"customer_address" varchar,
  	"customer_payment_method" varchar,
  	"customer_notes" varchar,
  	"total_amount" numeric NOT NULL,
  	"currency" varchar DEFAULT 'USD',
  	"delivery_type" "enum_orders_delivery_type" DEFAULT 'delivery',
  	"delivery_details_municipality" varchar,
  	"delivery_details_residence_zone" varchar,
  	"delivery_details_building_house" varchar,
  	"delivery_details_reference_point" varchar,
  	"payment_details_method_key" "enum_orders_payment_details_method_key",
  	"payment_details_reference_number" varchar,
  	"payment_details_issuing_bank" varchar,
  	"payment_details_issuing_phone" varchar,
  	"payment_details_sender_name" varchar,
  	"payment_details_sender_email" varchar,
  	"payment_details_binance_sender_id" varchar,
  	"payment_details_payment_status" "enum_orders_payment_details_payment_status" DEFAULT 'pending_verification',
  	"crm_counted" boolean DEFAULT false,
  	"trello_card_url" varchar,
  	"email_confirmation_sent" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "customers_saved_addresses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"municipality" varchar,
  	"residence_zone" varchar,
  	"building_house" varchar,
  	"reference_point" varchar,
  	"address" varchar
  );
  
  CREATE TABLE "customers_purchase_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"order_id_id" integer,
  	"amount" numeric,
  	"date" timestamp(3) with time zone,
  	"items_summary" varchar,
  	"delivery_type" "enum_customers_purchase_history_delivery_type"
  );
  
  CREATE TABLE "customers_preferences_preferred_categories" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category" varchar
  );
  
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"name" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"email" varchar,
  	"tag" "enum_customers_tag" DEFAULT 'nuevo',
  	"total_orders" numeric DEFAULT 1,
  	"total_spent" numeric DEFAULT 0,
  	"last_order_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"preferences_preferred_payment_method" varchar,
  	"preferences_preferred_delivery_type" "enum_customers_preferences_preferred_delivery_type",
  	"preferences_average_order_value" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"workflow_slug" "enum_payload_jobs_workflow_slug",
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"meta" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tenants_id" integer,
  	"users_id" integer,
  	"categories_id" integer,
  	"products_id" integer,
  	"orders_id" integer,
  	"customers_id" integer,
  	"media_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_jobs_stats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stats" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "tenants_delivery_config_zones" ADD CONSTRAINT "tenants_delivery_config_zones_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_branding_logo_id_media_id_fk" FOREIGN KEY ("branding_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_tenants" ADD CONSTRAINT "users_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_tenants" ADD CONSTRAINT "users_tenants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_images" ADD CONSTRAINT "products_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_images" ADD CONSTRAINT "products_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_variants" ADD CONSTRAINT "products_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_modifiers_options" ADD CONSTRAINT "products_modifiers_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_modifiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_modifiers" ADD CONSTRAINT "products_modifiers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_texts" ADD CONSTRAINT "products_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers_saved_addresses" ADD CONSTRAINT "customers_saved_addresses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_purchase_history" ADD CONSTRAINT "customers_purchase_history_order_id_id_orders_id_fk" FOREIGN KEY ("order_id_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers_purchase_history" ADD CONSTRAINT "customers_purchase_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_preferences_preferred_categories" ADD CONSTRAINT "customers_preferences_preferred_categories_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "tenants_delivery_config_zones_order_idx" ON "tenants_delivery_config_zones" USING btree ("_order");
  CREATE INDEX "tenants_delivery_config_zones_parent_id_idx" ON "tenants_delivery_config_zones" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "tenants_slug_idx" ON "tenants" USING btree ("slug");
  CREATE INDEX "tenants_email_config_email_config_from_email_idx" ON "tenants" USING btree ("email_config_from_email");
  CREATE INDEX "tenants_branding_branding_logo_idx" ON "tenants" USING btree ("branding_logo_id");
  CREATE INDEX "tenants_meta_meta_image_idx" ON "tenants" USING btree ("meta_image_id");
  CREATE INDEX "tenants_updated_at_idx" ON "tenants" USING btree ("updated_at");
  CREATE INDEX "tenants_created_at_idx" ON "tenants" USING btree ("created_at");
  CREATE INDEX "users_tenants_order_idx" ON "users_tenants" USING btree ("_order");
  CREATE INDEX "users_tenants_parent_id_idx" ON "users_tenants" USING btree ("_parent_id");
  CREATE INDEX "users_tenants_tenant_idx" ON "users_tenants" USING btree ("tenant_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "categories_tenant_idx" ON "categories" USING btree ("tenant_id");
  CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE INDEX "products_images_order_idx" ON "products_images" USING btree ("_order");
  CREATE INDEX "products_images_parent_id_idx" ON "products_images" USING btree ("_parent_id");
  CREATE INDEX "products_images_image_idx" ON "products_images" USING btree ("image_id");
  CREATE INDEX "products_variants_order_idx" ON "products_variants" USING btree ("_order");
  CREATE INDEX "products_variants_parent_id_idx" ON "products_variants" USING btree ("_parent_id");
  CREATE INDEX "products_modifiers_options_order_idx" ON "products_modifiers_options" USING btree ("_order");
  CREATE INDEX "products_modifiers_options_parent_id_idx" ON "products_modifiers_options" USING btree ("_parent_id");
  CREATE INDEX "products_modifiers_order_idx" ON "products_modifiers" USING btree ("_order");
  CREATE INDEX "products_modifiers_parent_id_idx" ON "products_modifiers" USING btree ("_parent_id");
  CREATE INDEX "products_tenant_idx" ON "products" USING btree ("tenant_id");
  CREATE INDEX "products_sku_idx" ON "products" USING btree ("sku");
  CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");
  CREATE INDEX "products_meta_meta_image_idx" ON "products" USING btree ("meta_image_id");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE INDEX "products_texts_order_parent" ON "products_texts" USING btree ("order","parent_id");
  CREATE INDEX "orders_items_order_idx" ON "orders_items" USING btree ("_order");
  CREATE INDEX "orders_items_parent_id_idx" ON "orders_items" USING btree ("_parent_id");
  CREATE INDEX "orders_tenant_idx" ON "orders" USING btree ("tenant_id");
  CREATE UNIQUE INDEX "orders_order_number_idx" ON "orders" USING btree ("order_number");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  CREATE INDEX "customers_saved_addresses_order_idx" ON "customers_saved_addresses" USING btree ("_order");
  CREATE INDEX "customers_saved_addresses_parent_id_idx" ON "customers_saved_addresses" USING btree ("_parent_id");
  CREATE INDEX "customers_purchase_history_order_idx" ON "customers_purchase_history" USING btree ("_order");
  CREATE INDEX "customers_purchase_history_parent_id_idx" ON "customers_purchase_history" USING btree ("_parent_id");
  CREATE INDEX "customers_purchase_history_order_id_idx" ON "customers_purchase_history" USING btree ("order_id_id");
  CREATE INDEX "customers_preferences_preferred_categories_order_idx" ON "customers_preferences_preferred_categories" USING btree ("_order");
  CREATE INDEX "customers_preferences_preferred_categories_parent_id_idx" ON "customers_preferences_preferred_categories" USING btree ("_parent_id");
  CREATE INDEX "customers_tenant_idx" ON "customers" USING btree ("tenant_id");
  CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE INDEX "media_tenant_idx" ON "media" USING btree ("tenant_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_workflow_slug_idx" ON "payload_jobs" USING btree ("workflow_slug");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_tenants_id_idx" ON "payload_locked_documents_rels" USING btree ("tenants_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)

  // 3b. Columna LEGACY `products.image_url`: existe en PRODUCCIÓN hoy (fase
  //     expand de 20260829_products_image_urls — el contract/drop fue
  //     diferido) y los backfills históricos 20260829/20260902 hacen SQL
  //     directo contra ella SIN guardia de columna. Sin esta columna en la
  //     reconstrucción, la cadena explota a mitad (verificado: "column
  //     image_url does not exist") y una BD nueva/restaurada no arranca.
  //     El baseline debe reproducir la BD REAL, incluida su deuda legacy —
  //     el drop es un PR de contracción futuro (expand/contract, §4).
  await db.execute(sql`
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "image_url" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "tenants_delivery_config_zones" CASCADE;
  DROP TABLE "tenants" CASCADE;
  DROP TABLE "users_tenants" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "products_images" CASCADE;
  DROP TABLE "products_variants" CASCADE;
  DROP TABLE "products_modifiers_options" CASCADE;
  DROP TABLE "products_modifiers" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_texts" CASCADE;
  DROP TABLE "orders_items" CASCADE;
  DROP TABLE "orders" CASCADE;
  DROP TABLE "customers_saved_addresses" CASCADE;
  DROP TABLE "customers_purchase_history" CASCADE;
  DROP TABLE "customers_preferences_preferred_categories" CASCADE;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "payload_jobs_stats" CASCADE;
  DROP TYPE "public"."enum_tenants_theme";
  DROP TYPE "public"."enum_tenants_plan";
  DROP TYPE "public"."enum_tenants_branding_currency";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_products_variants_stock_status";
  DROP TYPE "public"."enum_products_stock_status";
  DROP TYPE "public"."enum_orders_status";
  DROP TYPE "public"."enum_orders_delivery_type";
  DROP TYPE "public"."enum_orders_payment_details_method_key";
  DROP TYPE "public"."enum_orders_payment_details_payment_status";
  DROP TYPE "public"."enum_customers_purchase_history_delivery_type";
  DROP TYPE "public"."enum_customers_tag";
  DROP TYPE "public"."enum_customers_preferences_preferred_delivery_type";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_workflow_slug";
  DROP TYPE "public"."enum_payload_jobs_task_slug";`)
}

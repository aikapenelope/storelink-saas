import * as migration_20260819_add_theme_emailconfig_variants_modifiers from './20260819_add_theme_emailconfig_variants_modifiers';
import * as migration_20260819_v2_pickup_payment_delivery from './20260819_v2_pickup_payment_delivery';
import * as migration_20260820_add_media_tenant_isolation from './20260820_add_media_tenant_isolation';
import * as migration_20260821_add_trello_workspace_fields from './20260821_add_trello_workspace_fields';
import * as migration_20260821_2_order_uniqueness_rate_snapshot from './20260821_2_order_uniqueness_rate_snapshot';
import * as migration_20260822_jobs_queue from './20260822_jobs_queue';
import * as migration_20260822_2_analytics_indexes from './20260822_2_analytics_indexes';
import * as migration_20260822_3_security_and_performance_optimizations from './20260822_3_security_and_performance_optimizations';
import * as migration_20260824_products_sku_index from './20260824_products_sku_index';
import * as migration_20260824_2_customers_tenant_phone_unique from './20260824_2_customers_tenant_phone_unique';
import * as migration_20260827_email_idempotency_and_category_slug_unique from './20260827_email_idempotency_and_category_slug_unique';
import * as migration_20260828_add_tenant_delivery_config_columns from './20260828_add_tenant_delivery_config_columns';
import * as migration_20260829_add_trello_byok_and_list_id_fix from './20260829_add_trello_byok_and_list_id_fix';
import * as migration_20260829_products_image_urls from './20260829_products_image_urls';
import * as migration_20260830_tenants_from_email_unique from './20260830_tenants_from_email_unique';
import * as migration_20260901_trello_list_id_unique from './20260901_trello_list_id_unique';
import * as migration_20260901_2_customers_crm_expansion from './20260901_2_customers_crm_expansion';

import * as migration_20260902_repair_customers_crm_schema from './20260902_repair_customers_crm_schema';
import * as migration_20260902_backfill_normalize_drive_image_urls from './20260902_backfill_normalize_drive_image_urls';

export const migrations = [
  {
    up: migration_20260819_add_theme_emailconfig_variants_modifiers.up,
    down: migration_20260819_add_theme_emailconfig_variants_modifiers.down,
    name: '20260819_add_theme_emailconfig_variants_modifiers',
  },
  {
    up: migration_20260819_v2_pickup_payment_delivery.up,
    down: migration_20260819_v2_pickup_payment_delivery.down,
    name: '20260819_v2_pickup_payment_delivery',
  },
  {
    up: migration_20260820_add_media_tenant_isolation.up,
    down: migration_20260820_add_media_tenant_isolation.down,
    name: '20260820_add_media_tenant_isolation',
  },
  {
    up: migration_20260821_add_trello_workspace_fields.up,
    down: migration_20260821_add_trello_workspace_fields.down,
    name: '20260821_add_trello_workspace_fields',
  },
  {
    up: migration_20260821_2_order_uniqueness_rate_snapshot.up,
    down: migration_20260821_2_order_uniqueness_rate_snapshot.down,
    name: '20260821_2_order_uniqueness_rate_snapshot',
  },
  {
    up: migration_20260822_jobs_queue.up,
    down: migration_20260822_jobs_queue.down,
    name: '20260822_jobs_queue',
  },
  {
    up: migration_20260822_2_analytics_indexes.up,
    down: migration_20260822_2_analytics_indexes.down,
    name: '20260822_2_analytics_indexes',
  },
  {
    up: migration_20260822_3_security_and_performance_optimizations.up,
    down: migration_20260822_3_security_and_performance_optimizations.down,
    name: '20260822_3_security_and_performance_optimizations',
  },
  {
    up: migration_20260824_products_sku_index.up,
    down: migration_20260824_products_sku_index.down,
    name: '20260824_products_sku_index',
  },
  {
    up: migration_20260824_2_customers_tenant_phone_unique.up,
    down: migration_20260824_2_customers_tenant_phone_unique.down,
    name: '20260824_2_customers_tenant_phone_unique',
  },
  {
    up: migration_20260827_email_idempotency_and_category_slug_unique.up,
    down: migration_20260827_email_idempotency_and_category_slug_unique.down,
    name: '20260827_email_idempotency_and_category_slug_unique',
  },
  {
    // P0 HOTFIX: schema drift — delivery_config_fixed_price y
    // delivery_config_estimated_time inexistentes en producción.
    up: migration_20260828_add_tenant_delivery_config_columns.up,
    down: migration_20260828_add_tenant_delivery_config_columns.down,
    name: '20260828_add_tenant_delivery_config_columns',
  },
  {
    up: migration_20260829_add_trello_byok_and_list_id_fix.up,
    down: migration_20260829_add_trello_byok_and_list_id_fix.down,
    name: '20260829_add_trello_byok_and_list_id_fix',
  },
  {
    up: migration_20260829_products_image_urls.up,
    down: migration_20260829_products_image_urls.down,
    name: '20260829_products_image_urls',
  },
  {
    up: migration_20260830_tenants_from_email_unique.up,
    down: migration_20260830_tenants_from_email_unique.down,
    name: '20260830_tenants_from_email_unique',
  },
  {
    up: migration_20260901_trello_list_id_unique.up,
    down: migration_20260901_trello_list_id_unique.down,
    name: '20260901_trello_list_id_unique',
  },
  {
    up: migration_20260901_2_customers_crm_expansion.up,
    down: migration_20260901_2_customers_crm_expansion.down,
    name: '20260901_2_customers_crm_expansion',
  },
  {
    up: migration_20260902_repair_customers_crm_schema.up,
    down: migration_20260902_repair_customers_crm_schema.down,
    name: '20260902_repair_customers_crm_schema',
  },
  {
    up: migration_20260902_backfill_normalize_drive_image_urls.up,
    down: migration_20260902_backfill_normalize_drive_image_urls.down,
    name: '20260902_backfill_normalize_drive_image_urls',
  },
];
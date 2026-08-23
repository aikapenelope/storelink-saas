import * as migration_20260819_add_theme_emailconfig_variants_modifiers from './20260819_add_theme_emailconfig_variants_modifiers';
import * as migration_20260819_v2_pickup_payment_delivery from './20260819_v2_pickup_payment_delivery';
import * as migration_20260820_add_media_tenant_isolation from './20260820_add_media_tenant_isolation';
import * as migration_20260821_add_trello_workspace_fields from './20260821_add_trello_workspace_fields';
import * as migration_20260821_2_order_uniqueness_rate_snapshot from './20260821_2_order_uniqueness_rate_snapshot';
import * as migration_20260822_jobs_queue from './20260822_jobs_queue';
import * as migration_20260822_2_analytics_indexes from './20260822_2_analytics_indexes';
import * as migration_20260822_3_security_and_performance_optimizations from './20260822_3_security_and_performance_optimizations';

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
];
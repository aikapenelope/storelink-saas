import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // TENANTS: Pickup config
  await db.execute(sql`
    ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS pickup_config_enabled BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS pickup_config_location_address TEXT,
      ADD COLUMN IF NOT EXISTS pickup_config_schedule VARCHAR,
      ADD COLUMN IF NOT EXISTS pickup_config_estimated_time VARCHAR,
      ADD COLUMN IF NOT EXISTS pickup_config_instructions VARCHAR
  `);

  // TENANTS: Payment methods config
  await db.execute(sql`
    ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS payment_methods_config_pago_movil_enabled BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS payment_methods_config_pago_movil_bank VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_methods_config_pago_movil_phone VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_methods_config_pago_movil_id_doc VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_methods_config_pago_movil_account_holder VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_methods_config_zelle_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS payment_methods_config_zelle_email VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_methods_config_zelle_account_holder VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_methods_config_binance_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS payment_methods_config_binance_pay_id VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_methods_config_binance_nickname VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_methods_config_zinli_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS payment_methods_config_zinli_email VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_methods_config_zinli_account_holder VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_methods_config_banesco_panama_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS payment_methods_config_banesco_panama_account_number VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_methods_config_banesco_panama_account_holder VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_methods_config_banesco_panama_account_type VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_methods_config_cash_enabled BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS payment_methods_config_cash_instructions VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_methods_config_pos_enabled BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS payment_methods_config_pos_instructions VARCHAR
  `);

  // TENANTS: Delivery zones
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tenants_delivery_config_zones (
      id SERIAL PRIMARY KEY,
      _order INTEGER NOT NULL,
      _parent_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR NOT NULL,
      price_delivery NUMERIC DEFAULT 0,
      estimated_time VARCHAR
    );
    CREATE INDEX IF NOT EXISTS tenants_delivery_zones_parent_idx ON tenants_delivery_config_zones(_parent_id);
    CREATE INDEX IF NOT EXISTS tenants_delivery_zones_order_idx ON tenants_delivery_config_zones(_order);
  `);

  // ORDERS: Delivery & Payment Details
  await db.execute(sql`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS delivery_type VARCHAR DEFAULT 'delivery',
      ADD COLUMN IF NOT EXISTS delivery_details_municipality VARCHAR,
      ADD COLUMN IF NOT EXISTS delivery_details_residence_zone VARCHAR,
      ADD COLUMN IF NOT EXISTS delivery_details_building_house VARCHAR,
      ADD COLUMN IF NOT EXISTS delivery_details_reference_point VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_details_method_key VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_details_reference_number VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_details_issuing_bank VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_details_issuing_phone VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_details_sender_name VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_details_sender_email VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_details_binance_sender_id VARCHAR,
      ADD COLUMN IF NOT EXISTS payment_details_payment_status VARCHAR DEFAULT 'pending_verification'
  `);

  // PRODUCTS_VARIANTS: Stock quantity
  await db.execute(sql`
    ALTER TABLE products_variants
      ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC
  `);

  // CUSTOMERS_SAVED_ADDRESSES: Structured fields
  await db.execute(sql`
    ALTER TABLE customers_saved_addresses
      ADD COLUMN IF NOT EXISTS label VARCHAR,
      ADD COLUMN IF NOT EXISTS municipality VARCHAR,
      ADD COLUMN IF NOT EXISTS residence_zone VARCHAR,
      ADD COLUMN IF NOT EXISTS building_house VARCHAR,
      ADD COLUMN IF NOT EXISTS reference_point VARCHAR
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS tenants_delivery_config_zones`);
  await db.execute(sql`
    ALTER TABLE products_variants DROP COLUMN IF EXISTS stock_quantity
  `);
}

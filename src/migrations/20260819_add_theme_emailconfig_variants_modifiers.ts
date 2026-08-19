import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // TENANTS: Add theme selector and full emailConfig group fields
  await db.execute(sql`
    ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS theme VARCHAR DEFAULT 'basic-banner',
      ADD COLUMN IF NOT EXISTS email_config_enabled BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS email_config_resend_api_key VARCHAR,
      ADD COLUMN IF NOT EXISTS email_config_from_email VARCHAR,
      ADD COLUMN IF NOT EXISTS email_config_notification_email VARCHAR,
      ADD COLUMN IF NOT EXISTS email_config_email_subject VARCHAR DEFAULT '🛍️ Confirmación y Comprobante de tu Pedido',
      ADD COLUMN IF NOT EXISTS branding_show_v_e_s BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS branding_exchange_rate_v_e_s NUMERIC
  `);

  // PRODUCTS: Add inventory tracking fields
  await db.execute(sql`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS track_stock BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC
  `);

  // PRODUCTS_VARIANTS: Product size/color/format variants
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS products_variants (
      id SERIAL PRIMARY KEY,
      _order INTEGER NOT NULL,
      _parent_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name VARCHAR NOT NULL,
      sku VARCHAR,
      price NUMERIC NOT NULL,
      stock_status VARCHAR DEFAULT 'in_stock'
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS products_variants_parent_id_idx ON products_variants(_parent_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS products_variants_order_idx ON products_variants(_order)`);

  // PRODUCTS_MODIFIERS: Modifier groups (extras, sauces, etc.)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS products_modifiers (
      id SERIAL PRIMARY KEY,
      _order INTEGER NOT NULL,
      _parent_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      group_name VARCHAR NOT NULL,
      required BOOLEAN DEFAULT false
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS products_modifiers_parent_id_idx ON products_modifiers(_parent_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS products_modifiers_order_idx ON products_modifiers(_order)`);

  // PRODUCTS_MODIFIERS_OPTIONS: Options within each modifier group
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS products_modifiers_options (
      id SERIAL PRIMARY KEY,
      _order INTEGER NOT NULL,
      _parent_id INTEGER NOT NULL REFERENCES products_modifiers(id) ON DELETE CASCADE,
      name VARCHAR NOT NULL,
      price_delta NUMERIC DEFAULT 0
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS products_modifiers_options_parent_id_idx ON products_modifiers_options(_parent_id)`);

  // ORDERS: Add customer email for receipt delivery
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS products_modifiers_options`);
  await db.execute(sql`DROP TABLE IF EXISTS products_modifiers`);
  await db.execute(sql`DROP TABLE IF EXISTS products_variants`);
  await db.execute(sql`ALTER TABLE products DROP COLUMN IF EXISTS track_stock, DROP COLUMN IF EXISTS stock_quantity`);
  await db.execute(sql`ALTER TABLE orders DROP COLUMN IF EXISTS customer_email`);
  await db.execute(sql`
    ALTER TABLE tenants
      DROP COLUMN IF EXISTS theme,
      DROP COLUMN IF EXISTS email_config_enabled,
      DROP COLUMN IF EXISTS email_config_resend_api_key,
      DROP COLUMN IF EXISTS email_config_from_email,
      DROP COLUMN IF EXISTS email_config_notification_email,
      DROP COLUMN IF EXISTS email_config_email_subject,
      DROP COLUMN IF EXISTS branding_show_v_e_s,
      DROP COLUMN IF EXISTS branding_exchange_rate_v_e_s
  `);
}

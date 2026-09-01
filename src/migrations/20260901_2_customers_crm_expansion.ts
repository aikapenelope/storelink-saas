import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Expansión del CRM Customers para incluir historial de compras y preferencias.
 * 
 * Campos nuevos:
 * - purchaseHistory: array de historial de pedidos (orderId, amount, date, itemsSummary, deliveryType)
 * - preferences: grupo con preferredPaymentMethod, preferredDeliveryType, averageOrderValue, preferredCategories
 * 
 * Nomenclatura verificada contra el patrón camelCase→snake_case de Payload:
 * - purchaseHistory → purchase_history (array)
 * - preferences → preferences (grupo)
 * - preferredPaymentMethod → preferred_payment_method
 * - preferredDeliveryType → preferred_delivery_type
 * - averageOrderValue → average_order_value
 * - preferredCategories → preferred_categories (array)
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "customers"
      ADD COLUMN IF NOT EXISTS "purchase_history" JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS "preferences" JSONB DEFAULT '{"preferredPaymentMethod":null,"preferredDeliveryType":"none","averageOrderValue":0,"preferredCategories":[]}'::jsonb;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "customers"
      DROP COLUMN IF EXISTS "preferences",
      DROP COLUMN IF EXISTS "purchase_history";
  `);
}

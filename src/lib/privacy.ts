import type { Payload, PayloadRequest } from 'payload';
import type { Customer } from '@/payload-types';
import { deleteDeliveryNotePdf } from '@/lib/delivery-note';

/**
 * Derecho al olvido / minimización de PII (auditoría 2026-09-04, P1-12).
 *
 * Antes NO existía ningún camino de eliminación: la petición de un cliente
 * obligaba a borrado manual del admin (rompiendo purchaseHistory y dejando
 * los PDF de Notas de Entrega con su PII en R2 para siempre).
 *
 * Diseño: ANONIMIZAR (no borrar el documento) para preservar los agregados
 * monetarios del CRM (totalOrders/totalSpent — datos contables del comercio)
 * y la integridad referencial de las órdenes, eliminando toda PII del
 * documento y de los PDF asociados en R2. La función de shaping es pura y
 * está testeada: garantiza que el doc resultante no conserva PII.
 */

/** Marcadores del doc anonimizado — sin PII, con agregados monetarios íntegros. */
export interface AnonymizationResult {
  anonymizedFields: string[];
  deliveryNotesDeleted: number;
}

/**
 * Construye el payload de anonimización. PURA (testeada). Reglas:
 *  - name → etiqueta genérica; email/notes → vacío.
 *  - phone → `anon-{id}` (úNICO requerido por el índice (tenant, phone); el id
 *    garantiza no colisión y no revela el número original).
 *  - savedAddresses/purchaseHistory/preferences.preferredCategories → vacíos.
 *  - preferences → valores sin PII ('none'/null).
 *  - totalOrders/totalSpent/lastOrderAt/tag: SE PRESERVAN (interés contable
 *    del comercio; el tag pasa a 'inactivo' porque el cliente ya no existe).
 */
export function buildAnonymizedCustomerData(customer: {
  id: number | string;
}): Record<string, unknown> {
  return {
    name: 'Cliente anonimizado',
    email: '',
    phone: `anon-${String(customer.id)}`,
    notes: '',
    savedAddresses: [],
    purchaseHistory: [],
    preferences: {
      preferredPaymentMethod: null,
      preferredDeliveryType: 'none',
      averageOrderValue: null,
      preferredCategories: [],
    },
    tag: 'inactivo',
  };
}

/** Campos cuya limpieza verifica el test de no-PII. */
export const ANONYMIZED_FIELDS = [
  'name',
  'email',
  'phone',
  'notes',
  'savedAddresses',
  'purchaseHistory',
  'preferences',
  'tag',
] as const;

/**
 * Orquesta la anonimización: Local API en nombre del usuario (overrideAccess
 * false + req → el plugin multi-tenant aísla por tenant), luego limpieza
 * best-effort de los PDF de Notas de Entrega de las órdenes de ese teléfono.
 */
export async function anonymizeCustomer({
  payload,
  req,
  customerId,
}: {
  payload: Payload;
  req: PayloadRequest;
  customerId: number | string;
}): Promise<AnonymizationResult> {
  // overrideAccess:false: el access de la colección (hasTenantAccess) aplica —
  // un tenant-admin solo puede anonimizar clientes de SU tienda; cross-tenant
  // = NotFound (no existencia, no 403 con información de que existe).
  const customer = (await payload.findByID({
    collection: 'customers',
    id: customerId,
    depth: 0,
    overrideAccess: false,
    user: req.user,
    req,
  })) as Customer | null;
  if (!customer) {
    throw new Error('Cliente no encontrado');
  }

  const tenantId = typeof customer.tenant === 'object' ? customer.tenant?.id : customer.tenant;

  // Órdenes del cliente (por teléfono, el identificador del checkout) ANTES de
  // anonimizar el doc — las órdenes guardan el teléfono inline en customer.phone.
  const ordersRes = await payload.find({
    collection: 'orders',
    depth: 0,
    limit: 200,
    overrideAccess: false,
    user: req.user,
    req,
    where: {
      and: [
        ...(tenantId != null ? [{ tenant: { equals: tenantId } }] : []),
        { 'customer.phone': { equals: customer.phone } },
      ],
    },
  });

  await payload.update({
    collection: 'customers',
    id: customerId,
    overrideAccess: false,
    user: req.user,
    req,
    data: buildAnonymizedCustomerData({ id: customerId }),
  });

  // Best-effort: borrar cada PDF (contiene nombre/teléfono/dirección).
  let deliveryNotesDeleted = 0;
  for (const order of ordersRes.docs) {
    const orderNumber = (order as { orderNumber?: string }).orderNumber;
    if (typeof orderNumber === 'string' && orderNumber.length > 0) {
      const deleted = await deleteDeliveryNotePdf(orderNumber);
      if (deleted) deliveryNotesDeleted += 1;
    }
  }

  console.log(
    `[storelink][privacy] Cliente ${customerId} anonimizado (tenant ${String(tenantId)}): ` +
      `${ordersRes.docs.length} órdenes asociadas, ${deliveryNotesDeleted} PDFs borrados.`
  );

  return { anonymizedFields: [...ANONYMIZED_FIELDS], deliveryNotesDeleted };
}

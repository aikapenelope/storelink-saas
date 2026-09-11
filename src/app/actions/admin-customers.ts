'use server';

import { getPayload } from 'payload';
import config from '@payload-config';
import { headers } from 'next/headers';
import type { Customer, Order } from '@/payload-types';
import type { Where } from 'payload';
import { normalizeCustomerPhone } from '@/lib/customers';
import { getUserTenantIds, isSuperAdmin } from '@/lib/utils';

const PAGE_SIZE = 25;

export interface FetchCustomersParams {
  page?: number;
  search?: string;
  segment?: 'all' | 'vip' | 'frecuente' | 'nuevo' | 'inactivo';
  sort?: string;
}

export interface CustomersPageResult {
  docs: Customer[];
  hasNextPage: boolean;
  totalDocs: number;
  totalPages: number;
  page: number;
}

/**
 * Paginación y búsqueda del Directorio de Compradores (CRM).
 * Utiliza estrictamente Local API con user y overrideAccess: false para garantizar
 * el aislamiento multi-tenant a nivel de base de datos.
 */
export async function fetchCustomersPage({
  page = 1,
  search = '',
  segment = 'all',
  sort = '-totalSpent',
}: FetchCustomersParams): Promise<CustomersPageResult> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });

  if (!user) {
    return { docs: [], hasNextPage: false, totalDocs: 0, totalPages: 0, page: 1 };
  }

  const andConditions: Where[] = [];

  // Búsqueda por texto (nombre, teléfono o email)
  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    const digitsOnly = trimmedSearch.replace(/\D/g, '');
    const searchConditions: Where[] = [
      { name: { contains: trimmedSearch } },
      { email: { contains: trimmedSearch } },
    ];
    if (digitsOnly) {
      searchConditions.push({ phone: { contains: digitsOnly } });
    } else {
      searchConditions.push({ phone: { contains: trimmedSearch } });
    }
    andConditions.push({ or: searchConditions });
  }

  // Filtro por segmento RFM
  if (segment && segment !== 'all') {
    if (segment === 'vip') {
      andConditions.push({
        or: [
          { tag: { equals: 'vip' } },
          { totalOrders: { greater_than_equal: 3 } },
          { totalSpent: { greater_than_equal: 50 } },
        ],
      });
    } else if (segment === 'frecuente') {
      andConditions.push({
        and: [
          {
            or: [
              { tag: { equals: 'frecuente' } },
              { totalOrders: { equals: 2 } },
            ],
          },
          { tag: { not_equals: 'vip' } },
          { totalOrders: { less_than: 3 } },
          { totalSpent: { less_than: 50 } },
        ],
      });
    } else if (segment === 'inactivo') {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      andConditions.push({
        or: [
          { tag: { equals: 'inactivo' } },
          { lastOrderAt: { less_than: sixtyDaysAgo } },
        ],
      });
    } else if (segment === 'nuevo') {
      andConditions.push({
        and: [
          { totalOrders: { less_than_equal: 1 } },
          { tag: { not_equals: 'vip' } },
          { tag: { not_equals: 'inactivo' } },
        ],
      });
    }
  }

  const where: Where = andConditions.length > 0 ? { and: andConditions } : {};

  const res = await payload.find({
    collection: 'customers',
    page,
    limit: PAGE_SIZE,
    where,
    sort,
    depth: 0,
    user,
    overrideAccess: false,
  });

  return {
    docs: res.docs as Customer[],
    hasNextPage: res.hasNextPage,
    totalDocs: res.totalDocs,
    totalPages: res.totalPages,
    page: res.page ?? page,
  };
}

export interface ImportCustomerItem {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}

export interface ImportBatchResult {
  success: boolean;
  createdCount: number;
  updatedCount: number;
  errors: string[];
}

/**
 * Importación y migración de contactos/compradores por lotes.
 * Valida los datos, sanitiza teléfonos con prefijo 58 y realiza operaciones idempotentes.
 */
export async function importCustomersBatch(
  customers: ImportCustomerItem[]
): Promise<ImportBatchResult> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });

  if (!user) {
    return { success: false, createdCount: 0, updatedCount: 0, errors: ['No autenticado'] };
  }

  const tenantIds = getUserTenantIds(user);
  let targetTenantId: number | string | null = tenantIds.length > 0 ? tenantIds[0] : null;

  if (!targetTenantId && isSuperAdmin(user)) {
    // Para super-admin sin tenant en sesión, consultar el primer tenant disponible
    const firstTenant = await payload.find({ collection: 'tenants', limit: 1 });
    if (firstTenant.docs.length > 0) {
      targetTenantId = firstTenant.docs[0].id;
    }
  }

  if (!targetTenantId) {
    return {
      success: false,
      createdCount: 0,
      updatedCount: 0,
      errors: ['No se encontró una tienda asignada para registrar los contactos.'],
    };
  }

  let createdCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  for (const item of customers) {
    const rawName = item.name ? item.name.trim() : '';
    const normPhone = normalizeCustomerPhone(item.phone || '');

    if (!rawName) {
      errors.push(`Fila omitida: falta el nombre (teléfono: ${item.phone || 'vacío'})`);
      continue;
    }

    if (!normPhone || normPhone.length < 8) {
      errors.push(`Fila omitida para "${rawName}": teléfono inválido ("${item.phone}")`);
      continue;
    }

    try {
      // Verificar si el cliente ya existe por teléfono para este comercio
      const existing = await payload.find({
        collection: 'customers',
        where: { phone: { equals: normPhone } },
        limit: 1,
        user,
        overrideAccess: false,
      });

      if (existing.docs.length > 0) {
        const existingDoc = existing.docs[0];
        await payload.update({
          collection: 'customers',
          id: existingDoc.id,
          data: {
            name: rawName,
            ...(item.email?.trim() ? { email: item.email.trim() } : {}),
            ...(item.notes?.trim()
              ? { notes: existingDoc.notes ? `${existingDoc.notes}\n${item.notes.trim()}` : item.notes.trim() }
              : {}),
          },
          user,
          overrideAccess: false,
        });
        updatedCount++;
      } else {
        const tenantIdNum = typeof targetTenantId === 'number' ? targetTenantId : Number(targetTenantId);
        await payload.create({
          collection: 'customers',
          data: {
            name: rawName,
            phone: normPhone,
            email: item.email?.trim() || undefined,
            notes: item.notes?.trim() || undefined,
            tag: 'nuevo',
            totalOrders: 0,
            totalSpent: 0,
            tenant: isNaN(tenantIdNum) ? undefined : tenantIdNum,
          },
          user,
          overrideAccess: false,
        });
        createdCount++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      errors.push(`Error procesando "${rawName}" (${normPhone}): ${msg}`);
    }
  }

  return {
    success: errors.length === 0 || createdCount > 0 || updatedCount > 0,
    createdCount,
    updatedCount,
    errors,
  };
}

/**
 * Actualiza las notas internas de un cliente.
 */
export async function updateCustomerNotes(
  customerId: number | string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: await headers() });

    if (!user) {
      return { success: false, error: 'No autenticado' };
    }

    await payload.update({
      collection: 'customers',
      id: customerId,
      data: { notes },
      user,
      overrideAccess: false,
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al actualizar nota';
    return { success: false, error: msg };
  }
}

/**
 * Actualiza la etiqueta / segmento de un cliente (ej. marcar como VIP manualmente).
 */
export async function updateCustomerTag(
  customerId: number | string,
  tag: 'nuevo' | 'frecuente' | 'vip' | 'inactivo'
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: await headers() });

    if (!user) {
      return { success: false, error: 'No autenticado' };
    }

    await payload.update({
      collection: 'customers',
      id: customerId,
      data: { tag },
      user,
      overrideAccess: false,
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al actualizar etiqueta';
    return { success: false, error: msg };
  }
}

/**
 * Consulta el historial de pedidos de un cliente para la ficha de detalle.
 */
export async function fetchCustomerOrders(
  phone: string
): Promise<Order[]> {
  try {
    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: await headers() });

    if (!user || !phone) return [];

    const normPhone = normalizeCustomerPhone(phone);

    const res = await payload.find({
      collection: 'orders',
      where: {
        or: [
          { 'customer.phone': { equals: phone } },
          { 'customer.phone': { equals: normPhone } },
        ],
      },
      limit: 10,
      sort: '-createdAt',
      depth: 0,
      user,
      overrideAccess: false,
    });

    return res.docs as Order[];
  } catch (err) {
    console.error('Error al obtener pedidos del cliente:', err);
    return [];
  }
}

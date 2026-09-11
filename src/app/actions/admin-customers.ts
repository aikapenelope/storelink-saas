'use server';

import { getPayload } from 'payload';
import config from '@payload-config';
import { headers } from 'next/headers';
import type { Customer, Order } from '@/payload-types';
import type { Where } from 'payload';
import { normalizeCustomerPhone } from '@/lib/customers';
import { getUserTenantIds, isSuperAdmin, assertTenantAccess } from '@/lib/utils';

const PAGE_SIZE = 25;
const MAX_IMPORT_BATCH = 250;

const ALLOWED_SORT_FIELDS = new Set([
  '-totalSpent',
  'totalSpent',
  '-totalOrders',
  'totalOrders',
  '-createdAt',
  'createdAt',
  '-lastOrderAt',
  'lastOrderAt',
  'name',
  '-name',
]);

const VALID_SEGMENTS = new Set(['all', 'vip', 'frecuente', 'nuevo', 'inactivo']);

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
 * Incluye sanitización y cotas en parámetros para prevenir abusos de consulta.
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

  // Cotas y validación de parámetros
  const validPage = Math.max(1, Math.min(Math.floor(Number(page) || 1), 1000));
  const validSegment = (VALID_SEGMENTS.has(segment) ? segment : 'all') as NonNullable<FetchCustomersParams['segment']>;
  const validSort = ALLOWED_SORT_FIELDS.has(sort) ? sort : '-totalSpent';
  const trimmedSearch = (typeof search === 'string' ? search.trim() : '').slice(0, 100);

  const andConditions: Where[] = [];

  // Búsqueda por texto (nombre, teléfono o email)
  if (trimmedSearch) {
    const digitsOnly = trimmedSearch.replace(/\D/g, '');
    const normalizedPhone = normalizeCustomerPhone(trimmedSearch);
    const noLeadingZero = digitsOnly.replace(/^0+/, '');

    const searchConditions: Where[] = [
      { name: { contains: trimmedSearch } },
      { email: { contains: trimmedSearch } },
    ];

    if (digitsOnly) {
      searchConditions.push({ phone: { contains: digitsOnly } });
    }
    // Soporte para búsqueda local ej: '04141234567' encuentra el almacenado '584141234567'
    if (normalizedPhone && normalizedPhone !== digitsOnly) {
      searchConditions.push({ phone: { contains: normalizedPhone } });
    }
    if (noLeadingZero && noLeadingZero !== digitsOnly && noLeadingZero !== normalizedPhone) {
      searchConditions.push({ phone: { contains: noLeadingZero } });
    }
    if (!digitsOnly) {
      searchConditions.push({ phone: { contains: trimmedSearch } });
    }

    andConditions.push({ or: searchConditions });
  }

  // Filtro por segmento RFM con precedencia unificada y mutuamente excluyente
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  if (validSegment !== 'all') {
    if (validSegment === 'inactivo') {
      andConditions.push({
        or: [
          { tag: { equals: 'inactivo' } },
          { lastOrderAt: { less_than: sixtyDaysAgo } },
        ],
      });
    } else if (validSegment === 'vip') {
      andConditions.push({
        and: [
          { tag: { not_equals: 'inactivo' } },
          {
            or: [
              { lastOrderAt: { greater_than_equal: sixtyDaysAgo } },
              { lastOrderAt: { exists: false } },
            ],
          },
          {
            or: [
              { tag: { equals: 'vip' } },
              { totalOrders: { greater_than_equal: 3 } },
              { totalSpent: { greater_than_equal: 50 } },
            ],
          },
        ],
      });
    } else if (validSegment === 'frecuente') {
      andConditions.push({
        and: [
          { tag: { not_equals: 'inactivo' } },
          {
            or: [
              { lastOrderAt: { greater_than_equal: sixtyDaysAgo } },
              { lastOrderAt: { exists: false } },
            ],
          },
          { tag: { not_equals: 'vip' } },
          { totalOrders: { less_than: 3 } },
          { totalSpent: { less_than: 50 } },
          {
            or: [
              { tag: { equals: 'frecuente' } },
              { totalOrders: { equals: 2 } },
            ],
          },
        ],
      });
    } else if (validSegment === 'nuevo') {
      andConditions.push({
        and: [
          { tag: { not_equals: 'inactivo' } },
          {
            or: [
              { lastOrderAt: { greater_than_equal: sixtyDaysAgo } },
              { lastOrderAt: { exists: false } },
            ],
          },
          { tag: { not_equals: 'vip' } },
          { tag: { not_equals: 'frecuente' } },
          { totalOrders: { less_than_equal: 1 } },
          { totalSpent: { less_than: 50 } },
        ],
      });
    }
  }

  const where: Where = andConditions.length > 0 ? { and: andConditions } : {};

  const res = await payload.find({
    collection: 'customers',
    page: validPage,
    limit: PAGE_SIZE,
    where,
    sort: validSort,
    depth: 0,
    user,
    overrideAccess: false,
  });

  return {
    docs: res.docs as Customer[],
    hasNextPage: res.hasNextPage,
    totalDocs: res.totalDocs,
    totalPages: res.totalPages,
    page: res.page ?? validPage,
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
 * Permite especificar el tenantId explícito, valida autorización multi-tenant con assertTenantAccess,
 * sanitiza teléfonos al estándar E.164 (10-15 dígitos) y previene duplicaciones canónicas.
 */
export async function importCustomersBatch(
  customers: ImportCustomerItem[],
  explicitTenantId?: number | string
): Promise<ImportBatchResult> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });

  if (!user) {
    return { success: false, createdCount: 0, updatedCount: 0, errors: ['No autenticado'] };
  }

  if (!Array.isArray(customers) || customers.length === 0) {
    return {
      success: false,
      createdCount: 0,
      updatedCount: 0,
      errors: ['El lote de clientes enviado está vacío o tiene un formato no válido.'],
    };
  }

  if (customers.length > MAX_IMPORT_BATCH) {
    return {
      success: false,
      createdCount: 0,
      updatedCount: 0,
      errors: [`El lote excede el límite máximo permitido de ${MAX_IMPORT_BATCH} contactos por operación.`],
    };
  }

  const tenantIds = getUserTenantIds(user);
  let targetTenantId: number | string | null = explicitTenantId ?? (tenantIds.length > 0 ? tenantIds[0] : null);

  if (explicitTenantId && !assertTenantAccess(user, explicitTenantId)) {
    return {
      success: false,
      createdCount: 0,
      updatedCount: 0,
      errors: ['No estás autorizado para registrar clientes en el comercio seleccionado.'],
    };
  }

  if (!targetTenantId && isSuperAdmin(user)) {
    // Para super-admin sin tenant en sesión ni explícito, consultar el primer tenant disponible
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

  const tenantIdNum = typeof targetTenantId === 'number' ? targetTenantId : Number(targetTenantId);
  if (isNaN(tenantIdNum)) {
    return {
      success: false,
      createdCount: 0,
      updatedCount: 0,
      errors: ['Identificador de tienda no válido.'],
    };
  }

  let createdCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  for (const item of customers) {
    const rawName = typeof item?.name === 'string' ? item.name.trim().slice(0, 100) : '';
    const rawPhone = typeof item?.phone === 'string' ? item.phone.trim().slice(0, 30) : '';
    const normPhone = normalizeCustomerPhone(rawPhone);
    const rawEmail = typeof item?.email === 'string' && item.email.trim() ? item.email.trim().slice(0, 150) : undefined;
    const rawNotes = typeof item?.notes === 'string' && item.notes.trim() ? item.notes.trim().slice(0, 1000) : undefined;

    if (!rawName) {
      errors.push(`Fila omitida: falta el nombre (teléfono: ${rawPhone || 'vacío'})`);
      continue;
    }

    if (!normPhone || normPhone.length < 10 || normPhone.length > 15) {
      errors.push(`Fila omitida para "${rawName}": teléfono inválido ("${rawPhone}"). Debe tener entre 10 y 15 dígitos.`);
      continue;
    }

    try {
      // Verificar si el cliente ya existe por teléfono canónico o crudo para este comercio específico
      const existing = await payload.find({
        collection: 'customers',
        where: {
          and: [
            { tenant: { equals: tenantIdNum } },
            {
              or: [
                { phone: { equals: normPhone } },
                { phone: { equals: rawPhone } },
              ],
            },
          ],
        },
        limit: 1,
        user,
        overrideAccess: false,
      });

      if (existing.docs.length > 0) {
        const existingDoc = existing.docs[0];
        const combinedNotes = rawNotes
          ? existingDoc.notes
            ? `${existingDoc.notes}\n${rawNotes}`.slice(0, 2000)
            : rawNotes
          : undefined;

        await payload.update({
          collection: 'customers',
          id: existingDoc.id,
          data: {
            name: rawName,
            phone: normPhone, // Canonicaliza teléfonos legados a formato normalizado
            ...(rawEmail ? { email: rawEmail } : {}),
            ...(combinedNotes ? { notes: combinedNotes } : {}),
          },
          user,
          overrideAccess: false,
        });
        updatedCount++;
      } else {
        await payload.create({
          collection: 'customers',
          data: {
            name: rawName,
            phone: normPhone,
            email: rawEmail,
            notes: rawNotes,
            tag: 'nuevo',
            totalOrders: 0,
            totalSpent: 0,
            tenant: tenantIdNum,
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
 * Actualiza las notas internas de un cliente con validación de identificador y cota de longitud.
 */
export async function updateCustomerNotes(
  customerId: number | string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const id = typeof customerId === 'number' ? customerId : Number(customerId);
    if (isNaN(id) || id <= 0) {
      return { success: false, error: 'ID de cliente inválido' };
    }

    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: await headers() });

    if (!user) {
      return { success: false, error: 'No autenticado' };
    }

    const cappedNotes = typeof notes === 'string' ? notes.slice(0, 2000) : '';

    await payload.update({
      collection: 'customers',
      id,
      data: { notes: cappedNotes },
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
 * Actualiza la etiqueta / segmento de un cliente con validación de lista permitida.
 */
export async function updateCustomerTag(
  customerId: number | string,
  tag: 'nuevo' | 'frecuente' | 'vip' | 'inactivo'
): Promise<{ success: boolean; error?: string }> {
  try {
    const id = typeof customerId === 'number' ? customerId : Number(customerId);
    if (isNaN(id) || id <= 0) {
      return { success: false, error: 'ID de cliente inválido' };
    }

    if (!['nuevo', 'frecuente', 'vip', 'inactivo'].includes(tag)) {
      return { success: false, error: 'Etiqueta de cliente inválida' };
    }

    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: await headers() });

    if (!user) {
      return { success: false, error: 'No autenticado' };
    }

    await payload.update({
      collection: 'customers',
      id,
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
 * Consulta el historial de pedidos de un cliente para la ficha de detalle,
 * validando la longitud y formato del teléfono para prevenir consultas costosas.
 */
export async function fetchCustomerOrders(
  phone: string
): Promise<Order[]> {
  try {
    if (!phone || typeof phone !== 'string' || phone.length > 30) {
      return [];
    }

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) {
      return [];
    }

    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: await headers() });

    if (!user) return [];

    const normPhone = normalizeCustomerPhone(phone);
    const noLeadingZero = digits.replace(/^0+/, '');

    const orConditions: Where[] = [
      { 'customer.phone': { equals: phone } },
    ];
    if (digits && digits !== phone) {
      orConditions.push({ 'customer.phone': { equals: digits } });
    }
    if (normPhone && normPhone !== phone && normPhone !== digits) {
      orConditions.push({ 'customer.phone': { equals: normPhone } });
    }
    if (noLeadingZero && noLeadingZero !== phone && noLeadingZero !== digits && noLeadingZero !== normPhone) {
      orConditions.push({ 'customer.phone': { equals: noLeadingZero } });
    }

    const res = await payload.find({
      collection: 'orders',
      where: {
        or: orConditions,
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

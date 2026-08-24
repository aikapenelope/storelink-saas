'use server';

import { getPayload } from 'payload';
import config from '@/payload.config';
import { headers } from 'next/headers';
import type { Order } from '@/payload-types';

const PAGE_SIZE = 25;

// Paginación real del dashboard: devuelve la página de pedidos del usuario
// autenticado (filtrada por su tenant vía access control de Payload).
export async function fetchOrdersPage(
  page: number
): Promise<{ docs: Order[]; hasNextPage: boolean; totalDocs: number }> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });

  if (!user) {
    return { docs: [], hasNextPage: false, totalDocs: 0 };
  }

  // Patrón oficial Local API (docs/local-api): sin overrideAccess:false el
  // access control NO corre y el listado sería global para cualquier usuario
  // autenticado. Con false + user, el plugin multi-tenant filtra por tenancia.
  const res = await payload.find({
    collection: 'orders',
    page,
    limit: PAGE_SIZE,
    sort: '-createdAt',
    depth: 0,
    user,
    overrideAccess: false,
  });

  return {
    docs: res.docs as Order[],
    hasNextPage: res.hasNextPage,
    totalDocs: res.totalDocs,
  };
}
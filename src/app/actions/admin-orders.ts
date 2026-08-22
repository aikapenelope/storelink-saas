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

  const res = await payload.find({
    collection: 'orders',
    page,
    limit: PAGE_SIZE,
    sort: '-createdAt',
    depth: 0,
  });

  return {
    docs: res.docs as Order[],
    hasNextPage: res.hasNextPage,
    totalDocs: res.totalDocs,
  };
}
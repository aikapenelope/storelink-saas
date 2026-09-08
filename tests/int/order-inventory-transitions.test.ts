import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import path from 'path';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import config from '../payload.config';

/**
 * PR 8 del roadmap post-auditoría 2026-09-07 (hallazgo C5):
 * red de regresión de las TRANSICIONES de inventario de Orders.
 *
 * Hueco detectado por la auditoría: los tests existentes solo cubrían el alta
 * (deducción) y su rechazo por sobreventa. Cero cobertura para:
 * cancel→reposición, delete→reposición, delta de edición (ambos signos,
 * regresión del bug de signo invertido de Devin #73), reactivación y la
 * reconciliación CRM de la cancelación (crmCounted).
 *
 * Convenciones del repo (tests/int/order-checkout-lifecycle.test.ts):
 * Payload real contra TEST_DATABASE_URI (config push:true de tests/payload.config),
 * serialización de archivos (fileParallelism:false) y producto PROPIO por test
 * para que cada transición arranque de números deterministas.
 */

// Sin jobs en este archivo: ejercitamos los HOOKS de colección directamente.
// Los mocks evitan que el import de jobs tire de red (Trello/email).
vi.mock('../../src/lib/trello', () => ({
  resolveTrelloCredentials: vi.fn(() => ({ apiKey: 'k', token: 't' })),
  createTrelloOrderCard: vi.fn(async () => ({ success: true })),
}));
vi.mock('../../src/lib/delivery-note', () => ({
  getDeliveryNoteUrl: vi.fn(async () => 'https://r2.example/signed.pdf'),
  uploadDeliveryNotePdf: vi.fn(async () => true),
}));
vi.mock('../../src/lib/email/resend-tenant-adapter', () => ({
  default: vi.fn(),
}));

const runIntegration = !!process.env.TEST_DATABASE_URI;
const d = runIntegration ? describe : describe.skip;

let payload: Payload;
let tenantId: number;

/** SKUs únicos por corrida: evitan colisiones con corridas previas en la BD compartida de CI. */
const uniqueSku = (label: string) => `INV-${label}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

const productBySku = async (sku: string) => {
  const res = await payload.find({
    collection: 'products',
    where: { and: [{ tenant: { equals: tenantId } }, { sku: { equals: sku } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  return res.docs[0];
};

/** Trae el stock base (o de variante) por SKU directo desde el doc del producto. */
const stockOf = async (
  sku: string,
  variantSku?: string
): Promise<number | undefined> => {
  const prod = await productBySku(sku);
  if (!prod) return undefined;
  if (variantSku) {
    const v = (prod.variants ?? []).find(
      (x: { sku?: string | null }) => x.sku === variantSku
    ) as { stockQuantity?: number } | undefined;
    return v?.stockQuantity;
  }
  return prod.stockQuantity;
};

const createProduct = async (sku: string, stock: number) =>
  payload.create({
    collection: 'products',
    overrideAccess: true,
    data: {
      tenant: tenantId,
      title: `Producto ${sku}`,
      price: 10,
      sku,
      trackStock: true,
      stockQuantity: stock,
      stockStatus: 'in_stock',
    } as never,
  });

const createOrder = async (args: {
  sku: string;
  qty: number;
  total: number;
  phone?: string;
  crmCounted?: boolean;
}) =>
  payload.create({
    collection: 'orders',
    overrideAccess: true,
    data: {
      tenant: tenantId,
      status: 'pending',
      orderNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      customer: {
        name: 'Cliente Inv',
        phone: args.phone ?? '+584129990001',
        email: 'inv@test.local',
      },
      items: [{ sku: args.sku, title: `Producto ${args.sku}`, price: 10, quantity: args.qty }],
      totalAmount: args.total,
      currency: 'USD',
      ...(args.crmCounted !== undefined ? { crmCounted: args.crmCounted } : {}),
    } as never,
  });

beforeAll(async () => {
  payload = await getPayload({ config: config as never });

  const tenant = await payload.create({
    collection: 'tenants',
    overrideAccess: true,
    data: {
      name: 'Tienda Inventario Test',
      slug: `inv-test-${Date.now()}`,
      whatsappPhone: '+584120000001',
    } as never,
  });
  tenantId = tenant.id as number;
}, 120000);

afterAll(async () => {
  await payload.destroy();
});

d('transiciones de inventario (hooks de Orders)', () => {
  it('cancelación: create descuenta y cancelar repone exactamente lo deducido', async () => {
    const sku = uniqueSku('CANCEL');
    await createProduct(sku, 10);

    const order = await createOrder({ sku, qty: 3, total: 30 });
    expect(await stockOf(sku)).toBe(7); // 10 − 3

    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: { status: 'cancelled' },
    });
    expect(await stockOf(sku)).toBe(10); // repuesto completo

    // Limpieza: la orden ya cancelada no vuelve a reponer al borrarla
    await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true });
    expect(await stockOf(sku)).toBe(10); // invariante: sin doble reposición
  }, 60000);

  it('borrado: borrar una orden ACTIVA repone el stock (restoreInventoryOnDeleteHook)', async () => {
    const sku = uniqueSku('DELETE');
    await createProduct(sku, 10);

    const order = await createOrder({ sku, qty: 2, total: 20 });
    expect(await stockOf(sku)).toBe(8);

    await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true });
    expect(await stockOf(sku)).toBe(10);
  }, 60000);

  it('borrado de orden CANCELADA no repone nada (evita doble reposición)', async () => {
    const sku = uniqueSku('DEL-CANCELLED');
    await createProduct(sku, 10);

    const order = await createOrder({ sku, qty: 2, total: 20 });
    expect(await stockOf(sku)).toBe(8);

    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: { status: 'cancelled' },
    });
    expect(await stockOf(sku)).toBe(10); // la cancelación repuso

    await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true });
    expect(await stockOf(sku)).toBe(10); // el borrado NO repone de nuevo
  }, 60000);

  it('edición: el delta de cantidad deduce aumentos y repone disminuciones (regresión Devin #73)', async () => {
    const sku = uniqueSku('EDIT');
    await createProduct(sku, 10);

    const order = await createOrder({ sku, qty: 2, total: 20 });
    expect(await stockOf(sku)).toBe(8);

    // Aumento 2→4: delta −2 con checkStock → stock 6
    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: {
        items: [{ sku, title: `Producto ${sku}`, price: 10, quantity: 4, subtotal: 40 }],
        totalAmount: 40,
      },
    } as never);
    expect(await stockOf(sku)).toBe(6);

    // Disminución 4→1: delta +3 → stock 9
    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: {
        items: [{ sku, title: `Producto ${sku}`, price: 10, quantity: 1, subtotal: 10 }],
        totalAmount: 10,
      },
    } as never);
    expect(await stockOf(sku)).toBe(9);
  }, 60000);

  it('edición que excede stock: APIError, rollback de la orden y del inventario', async () => {
    const sku = uniqueSku('EDIT-OOS');
    await createProduct(sku, 3);

    const order = await createOrder({ sku, qty: 2, total: 20 });
    expect(await stockOf(sku)).toBe(1);

    // 2→5: necesita 4 unidades, hay 1 → rechazo total (tx del request)
    await expect(
      payload.update({
        collection: 'orders',
        id: order.id,
        overrideAccess: true,
        data: {
          items: [{ sku, title: `Producto ${sku}`, price: 10, quantity: 5, subtotal: 50 }],
          totalAmount: 50,
        },
      } as never)
    ).rejects.toThrow(/Stock insuficiente/);

    // Rollback: la orden sigue con qty 2 y el stock quedó en 1
    expect(await stockOf(sku)).toBe(1);
    const unchanged = await payload.findByID({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      depth: 0,
    });
    const items = (unchanged as unknown as { items?: Array<{ quantity?: number }> }).items;
    expect(items?.[0]?.quantity).toBe(2);
  }, 60000);

  it('reactivación: cancelled → activo vuelve a deducir (sin doble deducción)', async () => {
    const sku = uniqueSku('REACT');
    await createProduct(sku, 10);

    const order = await createOrder({ sku, qty: 2, total: 20 });
    expect(await stockOf(sku)).toBe(8);

    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: { status: 'cancelled' },
    });
    expect(await stockOf(sku)).toBe(10);

    // Reactivar: deduce OTRA VEZ las mismas 2 unidades
    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: { status: 'pending' },
    });
    expect(await stockOf(sku)).toBe(8);
  }, 60000);

  it('CRM: la cancelación resta del cliente SOLO si crmCounted=true', async () => {
    const sku = uniqueSku('CRM');
    await createProduct(sku, 10);
    const phone = `+58${Date.now().toString().slice(-9)}`; // único por corrida

    // Cliente con historial previo (el delta UPDATEa la fila existente)
    const customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        name: 'Cliente CRM',
        phone,
        email: 'crm@test.local',
        totalOrders: 2,
        totalSpent: 60,
      } as never,
    });

    const readCustomer = async () =>
      payload.findByID({
        collection: 'customers',
        id: customer.id,
        overrideAccess: true,
        depth: 0,
      });

    // Caso 1: crmCounted=false (default) → cancelar NO resta CRM
    const orderNotCounted = await createOrder({ sku, qty: 1, total: 10, phone });
    await payload.update({
      collection: 'orders',
      id: orderNotCounted.id,
      overrideAccess: true,
      data: { status: 'cancelled' },
    });
    const afterNotCounted = (await readCustomer()) as unknown as {
      totalOrders?: number;
      totalSpent?: number;
    };
    expect(afterNotCounted.totalOrders).toBe(2);
    expect(Number(afterNotCounted.totalSpent)).toBe(60);

    // Caso 2: crmCounted=true → cancelar resta 1 orden y el totalAmount
    const orderCounted = await createOrder({ sku, qty: 1, total: 10, phone, crmCounted: true });
    await payload.update({
      collection: 'orders',
      id: orderCounted.id,
      overrideAccess: true,
      data: { status: 'cancelled' },
    });
    const afterCounted = (await readCustomer()) as unknown as {
      totalOrders?: number;
      totalSpent?: number;
    };
    expect(afterCounted.totalOrders).toBe(1); // 2 − 1
    expect(Number(afterCounted.totalSpent)).toBe(50); // 60 − 10

    // Invariante de cierre: las 2 órdenes qty 1 se crearon (−1 c/u) y ambas
    // cancelaciones repusieron → el stock vuelve al inicial.
    expect(await stockOf(sku)).toBe(10);
  }, 60000);
});

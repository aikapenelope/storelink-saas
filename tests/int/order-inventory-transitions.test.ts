import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import path from 'path';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import config from '../payload.config';
import { claimOrderCrmCounted } from '@/collections/Orders';

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
    sort: 'id', // determinista: ante duplicados históricos, el de MENOR id
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
    ) as { stockQuantity?: number | null } | undefined;
    return v?.stockQuantity ?? undefined;
  }
  return prod.stockQuantity ?? undefined;
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

  it('CRM (review Devin PR #91): editar el total de una orden contada NO altera totalOrders', async () => {
    const sku = uniqueSku('CRMEDIT');
    await createProduct(sku, 10);
    const phone = `+58${Date.now().toString().slice(-9)}E`; // único por corrida

    // Cliente con historial: 2 órdenes / $60
    const customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        name: 'Cliente CRM Edit',
        phone,
        email: 'crmedit@test.local',
        totalOrders: 2,
        totalSpent: 60,
      } as never,
    });

    const readCustomer = async () =>
      (await payload.findByID({
        collection: 'customers',
        id: customer.id,
        overrideAccess: true,
        depth: 0,
      })) as unknown as { totalOrders?: number | null; totalSpent?: number | null };

    const order = await createOrder({ sku, qty: 1, total: 10, phone, crmCounted: true });

    // Sube el total 10 → 40 (misma cantidad de ítems): solo gasto +30
    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: {
        items: [{ sku, title: `Producto ${sku}`, price: 40, quantity: 1, subtotal: 40 }],
        totalAmount: 40,
      },
    } as never);

    const afterEdit = (await readCustomer()) as unknown as {
      totalOrders?: number;
      totalSpent?: number;
    };
    expect(afterEdit.totalOrders).toBe(2); // INTACTO — antes: 3 (orden fantasma)
    expect(Number(afterEdit.totalSpent)).toBe(90); // 60 + 30 (solo la diferencia)

    // Baja el total 40 → 25: solo gasto −15
    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: {
        items: [{ sku, title: `Producto ${sku}`, price: 25, quantity: 1, subtotal: 25 }],
        totalAmount: 25,
      },
    } as never);

    const afterSecondEdit = (await readCustomer()) as unknown as {
      totalOrders?: number;
      totalSpent?: number;
    };
    expect(afterSecondEdit.totalOrders).toBe(2); // sigue INTACTO
    expect(Number(afterSecondEdit.totalSpent)).toBe(75); // 90 − 15

    // Limpieza: restaurar el stock deducido por la orden (queda activa)
    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: { status: 'cancelled' },
    });
  }, 60000);

  it('PR 2/A4: editar cantidad y cancelar en el MISMO save repone solo lo deducido (previousDoc.items)', async () => {
    const sku = uniqueSku('EDITCANCEL');
    await createProduct(sku, 10);

    // Alta: qty 2 deducidas → stock 8
    const order = await createOrder({ sku, qty: 2, total: 20 });
    expect(await stockOf(sku)).toBe(8);

    // Save simultáneo: cantidad 2→5 + status cancelled. Lo deducido FÍSICAMENTE
    // es 2 (la rama de edición no corre cuando isCancelled). La reposición
    // debe ser de 2 (previousDoc), NO de 5 (doc) → stock 10, no 13.
    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: {
        status: 'cancelled',
        items: [{ sku, title: `Producto ${sku}`, price: 10, quantity: 5, subtotal: 50 }],
        totalAmount: 50,
      },
    } as never);

    expect(await stockOf(sku)).toBe(10); // antes del fix: 13 (deriva +3)
  }, 60000);

  it('PR 2/A3: claim atómico de crmCounted — cancelación pre-claim compensa UNA sola vez; post-claim la hace el hook', async () => {
    const sku = uniqueSku('CLAIM');
    await createProduct(sku, 10);
    const phone = `+58${Date.now().toString().slice(-9)}C`;

    const customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        name: 'Cliente Claim',
        phone,
        email: 'claim@test.local',
        totalOrders: 2,
        totalSpent: 60,
      } as never,
    });

    const readCustomer = async () =>
      (await payload.findByID({
        collection: 'customers',
        id: customer.id,
        overrideAccess: true,
        depth: 0,
      })) as unknown as { totalOrders?: number | null; totalSpent?: number | null };

    // Simula el checkout: orden creada, CRM incrementado, y el admin cancela
    // ANTES de que el claim corra (el hook vio crmCounted=false → no restó).
    const order = await createOrder({ sku, qty: 1, total: 10, phone, crmCounted: false });
    const { claimed, status } = await claimOrderCrmCounted({
      payload,
      orderId: order.id as number,
    });

    // Caso simulado: cancelamos la orden ANTES de reclamar (secuencia de la
    // ventana del bug). El primer claim sobre orden viva:
    expect(claimed).toBe(true);
    expect(status).toBe('pending');

    // Cancelar: el hook ve crmCounted=true (el claim ya committeó) → resta.
    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: { status: 'cancelled' },
    });
    let cust = await readCustomer();
    expect(cust.totalOrders).toBe(1); // 2 − 1 (una sola resta)
    expect(Number(cust.totalSpent)).toBe(50); // 60 − 10

    // Idempotencia del claim: reclamar de nuevo → claimed=false, NADIE compensa
    const second = await claimOrderCrmCounted({ payload, orderId: order.id as number });
    expect(second.claimed).toBe(false);
    cust = await readCustomer();
    expect(cust.totalOrders).toBe(1); // sigue igual — sin doble resta
    expect(Number(cust.totalSpent)).toBe(50);
  }, 60000);

  it('PR 2/A3 (variante cancelada-pre-claim): el claim devuelve status=cancelled y el caller compensa una única vez', async () => {
    const sku = uniqueSku('CLAIMCANCEL');
    await createProduct(sku, 10);
    const phone = `+58${Date.now().toString().slice(-9)}D`;

    const customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        name: 'Cliente Claim Cancel',
        phone,
        email: 'claimc@test.local',
        totalOrders: 2,
        totalSpent: 60,
      } as never,
    });

    const readCustomer = async () =>
      (await payload.findByID({
        collection: 'customers',
        id: customer.id,
        overrideAccess: true,
        depth: 0,
      })) as unknown as { totalOrders?: number | null; totalSpent?: number | null };

    // La orden nace viva, el admin la cancela ANTES del claim (crmCounted=false
    // → el hook NO restó). El claim ATÓMICO trae status de esa misma fila.
    const order = await createOrder({ sku, qty: 1, total: 10, phone });
    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: { status: 'cancelled' },
    });

    const { claimed, status } = await claimOrderCrmCounted({
      payload,
      orderId: order.id as number,
    });
    expect(claimed).toBe(true);
    expect(status).toBe('cancelled'); // → el caller del checkout compensa

    // El caller (checkout) aplica la compensación única:
    const { applyCustomerCrmDelta } = await import('@/collections/Orders');
    await applyCustomerCrmDelta({
      payload,
      tenantId,
      phone,
      totalAmount: 10,
      sign: -1,
    });
    const cust = await readCustomer();
    expect(cust.totalOrders).toBe(1); // 2 − 1 exactamente
    expect(Number(cust.totalSpent)).toBe(50);
  }, 60000);

  it('PR 2/A3 (review Devin #92): rollback de claim+compensación deja la flag recuperable — el reintento completa exactamente una vez', async () => {
    const sku = uniqueSku('TXROLL');
    await createProduct(sku, 10);
    const phone = `+58${Date.now().toString().slice(-9)}T`;

    const customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        name: 'Cliente TxRoll',
        phone,
        email: 'txroll@test.local',
        totalOrders: 2,
        totalSpent: 60,
      } as never,
    });

    const readCustomer = async () =>
      (await payload.findByID({
        collection: 'customers',
        id: customer.id,
        overrideAccess: true,
        depth: 0,
      })) as unknown as { totalOrders?: number | null; totalSpent?: number | null };

    const order = await createOrder({ sku, qty: 1, total: 10, phone });
    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: { status: 'cancelled' },
    });

    // Simula el flujo del checkout: claim dentro de una tx explícita...
    const { applyCustomerCrmDelta, claimOrderCrmCounted } = await import('@/collections/Orders');
    const txId = await payload.db.beginTransaction();
    if (txId === null) throw new Error('beginTransaction devolvió null (¿transacciones deshabilitadas?)');
    const req = { transactionID: txId };
    const claim = await claimOrderCrmCounted({ payload, orderId: order.id as number, req });
    expect(claim.claimed).toBe(true);
    expect(claim.status).toBe('cancelled');

    // ...y el proceso MUERE antes de compensar → rollback total (flag incluida)
    await payload.db.rollbackTransaction(txId);

    // La flag NO quedó consumida: el reintento puede reclamar y completar
    const orderAfterRollback = (await payload.findByID({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      depth: 0,
    })) as unknown as { crmCounted?: boolean };
    expect(orderAfterRollback.crmCounted).toBe(false); // recuperable

    const tx2 = await payload.db.beginTransaction();
    if (tx2 === null) throw new Error('beginTransaction (reintento) devolvió null');
    const req2 = { transactionID: tx2 };
    const retry = await claimOrderCrmCounted({ payload, orderId: order.id as number, req: req2 });
    expect(retry.claimed).toBe(true); // el reintento SÍ puede reclamar
    expect(retry.status).toBe('cancelled');
    await applyCustomerCrmDelta({
      payload,
      tenantId,
      phone,
      totalAmount: 10,
      sign: -1,
      req: req2,
    });

    // Review Devin ronda 3: interrupción DESPUÉS del update del cliente — la
    // pareja claim+compensación comparte UNA sola tx: al abortar ANTES del
    // commit, NINGUNO de los dos debe aterrizar (flag en false, CRM intacto).
    await payload.db.rollbackTransaction(tx2);

    const custAfterInterruptedCommit = await readCustomer();
    expect(custAfterInterruptedCommit.totalOrders).toBe(2); // intacto
    expect(Number(custAfterInterruptedCommit.totalSpent)).toBe(60); // intacto
    const orderAfterInterrupted = (await payload.findByID({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      depth: 0,
    })) as unknown as { crmCounted?: boolean };
    expect(orderAfterInterrupted.crmCounted).toBe(false); // la flag también volvió

    // Tercer intento (el "proceso se recupera"): completa exactamente una vez
    const tx3 = await payload.db.beginTransaction();
    if (tx3 === null) throw new Error('beginTransaction (3er intento) devolvió null');
    const req3 = { transactionID: tx3 };
    const third = await claimOrderCrmCounted({ payload, orderId: order.id as number, req: req3 });
    expect(third.claimed).toBe(true);
    expect(third.status).toBe('cancelled');
    await applyCustomerCrmDelta({
      payload,
      tenantId,
      phone,
      totalAmount: 10,
      sign: -1,
      req: req3,
    });
    await payload.db.commitTransaction(tx3);

    const cust = await readCustomer();
    expect(cust.totalOrders).toBe(1); // 2 − 1 — completada EXACTAMENTE una vez
    expect(Number(cust.totalSpent)).toBe(50);
  }, 60000);

  it('PR 2/A4 (review Devin #92): cancelación con edición de total en el MISMO save resta el total PREVIO del CRM', async () => {
    const sku = uniqueSku('EDITTOTALC');
    await createProduct(sku, 10);
    const phone = `+58${Date.now().toString().slice(-9)}U`;

    const customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        name: 'Cliente EditTotalC',
        phone,
        email: 'edittc@test.local',
        totalOrders: 2,
        totalSpent: 60,
      } as never,
    });

    const readCustomer = async () =>
      (await payload.findByID({
        collection: 'customers',
        id: customer.id,
        overrideAccess: true,
        depth: 0,
      })) as unknown as { totalOrders?: number | null; totalSpent?: number | null };

    // Orden contada con total 10
    const order = await createOrder({ sku, qty: 1, total: 10, phone, crmCounted: true });

    // Mismo save: total 10→40 + status cancelled. El incremento CRM contó $10:
    // la reversa debe ser $10 del teléfono original, NO $40 del nuevo doc.
    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: {
        status: 'cancelled',
        items: [{ sku, title: `Producto ${sku}`, price: 40, quantity: 1, subtotal: 40 }],
        totalAmount: 40,
      },
    } as never);

    const cust = await readCustomer();
    expect(cust.totalOrders).toBe(1); // 2 − 1
    expect(Number(cust.totalSpent)).toBe(50); // 60 − 10 (el total PREVIO, no 40)
  }, 60000);

  it('PR 2/A4 (review Devin #92): cancelación con cambio de teléfono en el MISMO save resta del teléfono PREVIO', async () => {
    const sku = uniqueSku('EDITPHONEC');
    await createProduct(sku, 10);
    const oldPhone = `+58${Date.now().toString().slice(-9)}V`;
    const newPhone = `+58${Date.now().toString().slice(-9)}W`;

    // Cliente ORIGINAL con historial: fue el teléfono contado en el alta
    const customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        name: 'Cliente EditPhoneC',
        phone: oldPhone,
        email: 'editpc@test.local',
        totalOrders: 2,
        totalSpent: 60,
      } as never,
    });

    const readCustomer = async () =>
      (await payload.findByID({
        collection: 'customers',
        id: customer.id,
        overrideAccess: true,
        depth: 0,
      })) as unknown as { totalOrders?: number | null; totalSpent?: number | null };

    const order = await createOrder({ sku, qty: 1, total: 10, phone: oldPhone, crmCounted: true });

    // Mismo save: cambia el teléfono del customer + status cancelled. La reversa
    // debe tocar el teléfono VIEJO (el contado), no el nuevo.
    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: {
        status: 'cancelled',
        customer: {
          name: 'Cliente EditPhoneC',
          phone: newPhone,
          email: 'editpc@test.local',
        },
      },
    } as never);

    const cust = await readCustomer();
    expect(cust.totalOrders).toBe(1); // el teléfono ORIGINAL recibió la resta
    expect(Number(cust.totalSpent)).toBe(50);
  }, 60000);

  it('PR 3/A5: quantity inválida por el canal admin es rechazada por validación de colección', async () => {
    const sku = uniqueSku('QTYVAL');

    // quantity negativa: antes pasaba y el hook la interpretaba como delta +5
    // (AUMENTABA el stock). Ahora la validación de campo la rechaza ANTES del hook.
    await expect(
      createOrder({ sku, qty: -5, total: -50 })
    ).rejects.toThrow();

    // quantity 0: antes pasaba y Number(0) || 1 deducía 1 unidad fantasma
    await expect(
      createOrder({ sku, qty: 0, total: 0 })
    ).rejects.toThrow();

    // quantity fraccionada (2.5 unidades): entero requerido
    await expect(
      payload.create({
        collection: 'orders',
        overrideAccess: true,
        data: {
          tenant: tenantId,
          status: 'pending',
          orderNumber: `INV-QTY-${Date.now()}`,
          customer: { name: 'Cliente Qty', phone: '+584129990009', email: 'qty@test.local' },
          items: [{ sku, title: `Producto ${sku}`, price: 10, quantity: 2.5, subtotal: 25 }],
          totalAmount: 25,
          currency: 'USD',
        } as never,
      })
    ).rejects.toThrow();

    // quantity 999 (límite superior del carrito): válida, debe pasar la
    // validación de campo (la deducción se rechaza por stock aparte)
    // → usamos un producto sin trackStock para aislar SOLO la validación.
    const freeSku = uniqueSku('QTYFREE');
    await payload.create({
      collection: 'products',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        title: `Producto ${freeSku}`,
        price: 10,
        sku: freeSku,
        trackStock: false,
      } as never,
    });
    const valid = await createOrder({ sku: freeSku, qty: 999, total: 9990 });
    expect(valid).toBeTruthy();
  }, 60000);

  it('PR 3/C4: SKU duplicado dentro del mismo tenant es rechazado (base y variantes)', async () => {
    const skuA = uniqueSku('DUPA');
    const skuB = uniqueSku('DUPB');

    await createProduct(skuA, 10);

    // Otro producto del MISMO tenant con el mismo SKU base → rechazo
    await expect(
      payload.create({
        collection: 'products',
        overrideAccess: true,
        data: {
          tenant: tenantId,
          title: 'Clon A',
          price: 5,
          sku: skuA,
        } as never,
      })
    ).rejects.toThrow(/ya existente en este comercio/i);

    // Variante con el SKU base de otro producto → rechazo
    await expect(
      payload.create({
        collection: 'products',
        overrideAccess: true,
        data: {
          tenant: tenantId,
          title: 'Variante Clon',
          price: 5,
          sku: skuB,
          variants: [{ name: 'V', sku: skuA, price: 5 }],
        } as never,
      })
    ).rejects.toThrow(/ya existente en este comercio/i);

    // SKU repetido DENTRO del mismo producto (dos variantes con el MISMO SKU)
    const dupVariantSku = uniqueSku('SELFX');
    await expect(
      payload.create({
        collection: 'products',
        overrideAccess: true,
        data: {
          tenant: tenantId,
          title: 'Auto-conflicto',
          price: 5,
          sku: uniqueSku('SELF'),
          variants: [
            { name: 'V1', sku: dupVariantSku, price: 5 },
            { name: 'V2', sku: dupVariantSku, price: 5 },
          ],
        } as never,
      })
    ).rejects.toThrow(/repetido dentro del mismo producto/i);

    // EDITAR un producto existente para colisionar con otro → rechazo
    const prodB = await createProduct(skuB, 10);
    await expect(
      payload.update({
        collection: 'products',
        id: prodB.id,
        overrideAccess: true,
        data: { sku: skuA },
      } as never)
    ).rejects.toThrow(/ya existente en este comercio/i);

    // Editar el MISMO producto sin cambiar su SKU → OK (id: not_equals self)
    const updated = await payload.update({
      collection: 'products',
      id: prodB.id,
      overrideAccess: true,
      data: { price: 12 },
    });
    expect((updated as unknown as { price?: number }).price).toBe(12);
  }, 60000);

  it('PR 3 (review Devin #93): variante existente queda reutilizable como base de OTRO producto → rechazo', async () => {
    const baseSku = uniqueSku('VB');
    const variantSku = uniqueSku('VV');

    // Producto P1: base baseSku + variante variantSku
    await payload.create({
      collection: 'products',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        title: 'P1 con variante',
        price: 10,
        sku: baseSku,
        variants: [{ name: 'V', sku: variantSku, price: 10 }],
      } as never,
    });

    // P2 quiere usar variantSku (solo existe como VARIANTE de P1) → rechazo
    await expect(
      payload.create({
        collection: 'products',
        overrideAccess: true,
        data: { tenant: tenantId, title: 'P2 clon variante', price: 5, sku: variantSku },
      } as never)
    ).rejects.toThrow(/ya existente en este comercio/i);
  }, 60000);

  it('PR 3 (review Devin #93): update parcial valida el PRODUCTO RESULTANTE (no solo los campos enviados)', async () => {
    // Caso 1: update cambia el base a un valor que ya es variante PROPIA no enviada
    const baseA = uniqueSku('RB');
    const variantA = uniqueSku('RV');
    const p1 = await payload.create({
      collection: 'products',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        title: 'P1 resultante',
        price: 10,
        sku: baseA,
        variants: [{ name: 'V', sku: variantA, price: 10 }],
      } as never,
    });
    await expect(
      payload.update({
        collection: 'products',
        id: p1.id,
        overrideAccess: true,
        data: { sku: variantA }, // base pasa a chocar con su propia variante
      } as never)
    ).rejects.toThrow(/repetido dentro del mismo producto/i);

    // Caso 2: update reemplaza variantes con un SKU que ya es el base propio no enviado
    const p2 = await createProduct(uniqueSku('RB2'), 10);
    await expect(
      payload.update({
        collection: 'products',
        id: p2.id,
        overrideAccess: true,
        data: {
          variants: [{ name: 'V', sku: (p2 as unknown as { sku: string }).sku, price: 10 }],
        },
      } as never)
    ).rejects.toThrow(/repetido dentro del mismo producto/i);
  }, 60000);

  it('PR 3 (review Devin #93): duplicado HISTÓRICO no omite la deducción de los demás SKUs del pedido', async () => {
    // Simula datos previos al fix: dos productos con el MISMO SKU (el hook
    // nuevo impide crearlos, así que el duplicado se siembra por SQL directo).
    const { sql } = await import('@payloadcms/db-postgres/drizzle');
    const dupSku = uniqueSku('HIST');
    const otherSku = uniqueSku('HISTO');

    await createProduct(dupSku, 5); // producto A (menor id)
    await createProduct(otherSku, 4); // producto C (otro SKU)

    const tenantRow = await payload.db.drizzle.execute(
      sql`SELECT id FROM tenants WHERE slug LIKE 'inv-test-%' ORDER BY id DESC LIMIT 1`
    );
    const tenantNumeric = (tenantRow.rows[0] as { id: number }).id;
    const inserted = (await payload.db.drizzle.execute(
      sql`INSERT INTO products (title, sku, price, track_stock, stock_quantity, stock_status, tenant_id, created_at, updated_at)
          VALUES ('Duplicado histórico', ${dupSku}, 10, true, 5, 'in_stock', ${tenantNumeric}, now(), now())
          RETURNING id`
    )) as { rows?: Array<{ id: number }> };
    const duplicateId = inserted.rows?.[0]?.id;
    expect(duplicateId).toBeTruthy();

    // Pedido de 2 SKUs: el batch (limit = nº de SKUs) trae A+B (duplicados del
    // mismo sku, sort id) y C se quedaría FUERA → sin fallback no se deduciría.
    const order = await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        status: 'pending',
        orderNumber: `INV-DUP-${Date.now()}`,
        customer: { name: 'Cliente Dup', phone: '+584129990010', email: 'dup@test.local' },
        items: [
          { sku: dupSku, title: 'Duplicado', price: 10, quantity: 1, subtotal: 10 },
          { sku: otherSku, title: 'Otro', price: 10, quantity: 1, subtotal: 10 },
        ],
        totalAmount: 20,
        currency: 'USD',
      } as never,
    });

    // Ambos deducidos exactamente una vez:
    // El SKU duplicado: A (menor id) deducido → 4; el cludo SQL intacto → 5.
    const dupDocs = await payload.find({
      collection: 'products',
      where: { and: [{ tenant: { equals: tenantId } }, { sku: { equals: dupSku } }] },
      sort: 'id',
      depth: 0,
      overrideAccess: true,
    });
    const dupStocks = (dupDocs.docs as Array<{ stockQuantity?: number }>)
      .map((d) => d.stockQuantity)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(dupStocks).toEqual([4, 5]);
    expect(await stockOf(otherSku)).toBe(3); // C deducido — antes del fallback quedaba 4 (omisión silenciosa)

    // Limpieza del duplicado crudo
    await payload.db.drizzle.execute(sql`DELETE FROM products WHERE id = ${duplicateId}`);
    await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true });
  }, 60000);

  it('PR 3 (review Devin #93 ronda 2): pricing y descuento apuntan al MISMO producto ante duplicados históricos', async () => {
    // Orden de creación clave: A(X) → D(X, SQL) → C(Y). El batch sort id con
    // limit=2 trae [A, D] (mismo SKU X) y C cae al fallback. Sin el guard
    // `!baseBySku.has`, el último set pisaba con D (más nuevo): el pricing del
    // checkout apuntaba a A pero el descuento iría a D → overselling del A.
    const { sql } = await import('@payloadcms/db-postgres/drizzle');
    const dupSku = uniqueSku('R2X');
    const otherSku = uniqueSku('R2Y');

    await createProduct(dupSku, 5); // A (id menor)

    const tenantRow = await payload.db.drizzle.execute(
      sql`SELECT id FROM tenants WHERE slug LIKE 'inv-test-%' ORDER BY id DESC LIMIT 1`
    );
    const tenantNumeric = (tenantRow.rows[0] as { id: number }).id;
    const inserted = (await payload.db.drizzle.execute(
      sql`INSERT INTO products (title, sku, price, track_stock, stock_quantity, stock_status, tenant_id, created_at, updated_at)
          VALUES ('Duplicado r2', ${dupSku}, 10, true, 5, 'in_stock', ${tenantNumeric}, now(), now())
          RETURNING id`
    )) as { rows?: Array<{ id: number }> };
    const duplicateId = inserted.rows?.[0]?.id;

    const other = await createProduct(otherSku, 4); // C (id entre A y D)

    const order = await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        status: 'pending',
        orderNumber: `INV-R2-${Date.now()}`,
        customer: { name: 'Cliente R2', phone: '+584129990011', email: 'r2@test.local' },
        items: [
          { sku: dupSku, title: 'Dup', price: 10, quantity: 1, subtotal: 10 },
          { sku: otherSku, title: 'Otro', price: 10, quantity: 1, subtotal: 10 },
        ],
        totalAmount: 20,
        currency: 'USD',
      } as never,
    });

    // El descuento cayó en A (menor id, el mismo que elegiría el pricing):
    expect(await stockOf(dupSku)).toBe(4); // A deducido
    expect(await stockOf(otherSku)).toBe(3); // C (vía fallback) deducido

    // Limpieza
    await payload.db.drizzle.execute(sql`DELETE FROM products WHERE id = ${duplicateId}`);
    await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true });
    await payload.delete({ collection: 'products', id: other.id, overrideAccess: true });
  }, 60000);

  it('PR 3 (review Devin #93 ronda 2): el SKU se normaliza (trim) al guardar — sin bypass por espacios', async () => {
    const padded = `  ${uniqueSku('PAD')}  `;
    const created = await payload.create({
      collection: 'products',
      overrideAccess: true,
      data: { tenant: tenantId, title: 'Con espacios', price: 5, sku: padded },
    } as never);
    const storedSku = (created as unknown as { sku: string }).sku;
    expect(storedSku).toBe(storedSku.trim()); // quedó normalizado

    // El mismo SKU ya trimado choca con el almacenado → rechazo
    await expect(
      payload.create({
        collection: 'products',
        overrideAccess: true,
        data: { tenant: tenantId, title: 'Clon trimado', price: 5, sku: storedSku },
      } as never)
    ).rejects.toThrow(/ya existente en este comercio/i);
  }, 60000);
});

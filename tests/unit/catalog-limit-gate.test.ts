import { describe, expect, it, vi } from 'vitest';
import { APIError } from 'payload';

/**
 * PR 6b (SPEC-20260907-6, auditoría B3): frontera EXACTA del gate de cupo
 * de Products (enforceCatalogLimitOnCreate). El hook se importa por el
 * módulo de colección con req.payload mockeado — la decisión del gate es
 * función pura de (count, plan), verificada aquí sin sembrar 500 filas.
 *
 * Escenarios del AC: "Creación manual del producto 501 en plan básico →
 * rechazo con mensaje claro".
 */

const mockReq = ({
  plan,
  totalDocs,
  skipGate,
}: {
  plan: string | null;
  totalDocs: number;
  skipGate?: boolean;
}) =>
  ({
    context: skipGate ? { skipCatalogLimitGate: true } : {},
    payload: {
      findByID: vi.fn(async () => (plan ? { plan } : { plan: null })),
      count: vi.fn(async () => ({ totalDocs })),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

const dataOf = (tenantId: number) => ({ tenant: tenantId, title: 'X', price: 1 });

const importHook = async () => {
  // Import perezoso: el módulo de colección importa storefront-cache
  // (next/cache) — en node basta que la importación no ejecute código de
  // navegador. vitest lo resuelve sin mocks adicionales.
  const mod = await import('../../src/collections/Products');
  return mod;
};

describe('enforceCatalogLimitOnCreate — frontera de cupo (PR 6b)', () => {
  it('count == limit → APIError 403 con mensaje claro (producto 501 en plan básico)', async () => {
    const { Products } = await importHook();
    const hook = Products.hooks?.beforeChange?.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (h: any) => (h as { name?: string }).name === 'enforceCatalogLimitOnCreate'
    );
    // El hook está declarado como const nombrado: su function.name lo expone.
    expect(hook).toBeDefined();

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (hook as any)({
        data: dataOf(7),
        operation: 'create',
        req: mockReq({ plan: 'basico', totalDocs: 500 }),
      })
    ).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('Límite del plan alcanzado'),
    });
  });

  it('count < limit → pasa y devuelve data intacta', async () => {
    const { Products } = await importHook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hook = (Products.hooks?.beforeChange as any[]).find(
      (h) => h.name === 'enforceCatalogLimitOnCreate'
    );
    const data = dataOf(7);
    const result = await hook({
      data,
      operation: 'create',
      req: mockReq({ plan: 'basico', totalDocs: 499 }),
    });
    expect(result).toBe(data);
  });

  it('count > limit (downgrade) → rechaza también', async () => {
    const { Products } = await importHook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hook = (Products.hooks?.beforeChange as any[]).find(
      (h) => h.name === 'enforceCatalogLimitOnCreate'
    );
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (hook as any)({
        data: dataOf(7),
        operation: 'create',
        req: mockReq({ plan: 'basico', totalDocs: 730 }),
      })
    ).rejects.toMatchObject({ status: 403 });
  });

  it('operation update → NUNCA dispara el gate', async () => {
    const { Products } = await importHook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hook = (Products.hooks?.beforeChange as any[]).find(
      (h) => h.name === 'enforceCatalogLimitOnCreate'
    );
    const data = dataOf(7);
    const result = await hook({
      data,
      operation: 'update',
      req: mockReq({ plan: 'basico', totalDocs: 9999 }),
    });
    expect(result).toBe(data);
  });

  it('context.skipCatalogLimitGate (canal del import) → pasa', async () => {
    const { Products } = await importHook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hook = (Products.hooks?.beforeChange as any[]).find(
      (h) => h.name === 'enforceCatalogLimitOnCreate'
    );
    const data = dataOf(7);
    const result = await hook({
      data,
      operation: 'create',
      req: mockReq({ plan: 'basico', totalDocs: 500, skipGate: true }),
    });
    expect(result).toBe(data);
  });

  it('tenant ilegible (fallo findByID) → límite estándar (1000), fail-closed al conteo', async () => {
    const { Products } = await importHook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hook = (Products.hooks?.beforeChange as any[]).find(
      (h) => h.name === 'enforceCatalogLimitOnCreate'
    );
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (hook as any)({
        data: dataOf(7),
        operation: 'create',
        req: mockReq({ plan: null, totalDocs: 1000 }),
      })
    ).rejects.toMatchObject({ status: 403 });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchCustomersPage,
  importCustomersBatch,
  updateCustomerNotes,
  updateCustomerTag,
  fetchCustomerOrders,
} from '@/app/actions/admin-customers';
import { getCustomerKpis } from '@/lib/analytics';

const mockFind = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockAuth = vi.fn();
const mockDrizzleExecute = vi.fn();

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>();
  return {
    ...actual,
    getPayload: vi.fn(async () => ({
      auth: mockAuth,
      find: mockFind,
      create: mockCreate,
      update: mockUpdate,
      db: {
        drizzle: {
          execute: mockDrizzleExecute,
        },
        tableNameMap: new Map([
          ['orders', 'orders'],
          ['customers', 'customers'],
          ['orders_items', 'orders_items'],
        ]),
      },
    })),
  };
});

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

describe('admin-customers server actions & analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchCustomersPage', () => {
    it('returns empty result when user is not authenticated', async () => {
      mockAuth.mockResolvedValueOnce({ user: null });

      const result = await fetchCustomersPage({ page: 1 });
      expect(result).toEqual({
        docs: [],
        hasNextPage: false,
        totalDocs: 0,
        totalPages: 0,
        page: 1,
      });
      expect(mockFind).not.toHaveBeenCalled();
    });

    it('queries customers with overrideAccess: false and user session', async () => {
      const mockUser = { id: 1, email: 'admin@store.com', role: 'tenant-admin', tenants: [{ tenant: 10 }] };
      mockAuth.mockResolvedValueOnce({ user: mockUser });
      mockFind.mockResolvedValueOnce({
        docs: [{ id: 1, name: 'Juan Perez', phone: '584141234567' }],
        hasNextPage: false,
        totalDocs: 1,
        totalPages: 1,
        page: 1,
      });

      const result = await fetchCustomersPage({ page: 1, search: 'Juan', segment: 'vip' });

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'customers',
          page: 1,
          limit: 25,
          depth: 0,
          user: mockUser,
          overrideAccess: false,
        })
      );
      expect(result.docs.length).toBe(1);
      expect(result.docs[0].name).toBe('Juan Perez');
    });

    it('builds phone search conditions using sanitized digits', async () => {
      const mockUser = { id: 1, email: 'admin@store.com', role: 'tenant-admin', tenants: [{ tenant: 10 }] };
      mockAuth.mockResolvedValueOnce({ user: mockUser });
      mockFind.mockResolvedValueOnce({
        docs: [],
        hasNextPage: false,
        totalDocs: 0,
        totalPages: 0,
        page: 1,
      });

      await fetchCustomersPage({ page: 1, search: '+58 (414) 123-4567' });

      const callArg = mockFind.mock.calls[0][0];
      expect(callArg.where.and[0].or).toEqual(
        expect.arrayContaining([
          { phone: { contains: '584141234567' } },
        ])
      );
    });

    it('matches stored international phone when searching with local 0414 format', async () => {
      const mockUser = { id: 1, email: 'admin@store.com', role: 'tenant-admin', tenants: [{ tenant: 10 }] };
      mockAuth.mockResolvedValueOnce({ user: mockUser });
      mockFind.mockResolvedValueOnce({
        docs: [],
        hasNextPage: false,
        totalDocs: 0,
        totalPages: 0,
        page: 1,
      });

      await fetchCustomersPage({ page: 1, search: '0414-1234567' });

      const callArg = mockFind.mock.calls[0][0];
      expect(callArg.where.and[0].or).toEqual(
        expect.arrayContaining([
          { phone: { contains: '584141234567' } },
          { phone: { contains: '04141234567' } },
          { phone: { contains: '4141234567' } },
        ])
      );
    });
  });

  describe('importCustomersBatch', () => {
    it('rejects batches exceeding MAX_IMPORT_BATCH (250)', async () => {
      const mockUser = { id: 1, role: 'tenant-admin', tenants: [{ tenant: 10 }] };
      mockAuth.mockResolvedValueOnce({ user: mockUser });

      const bigBatch = Array.from({ length: 251 }, (_, i) => ({
        name: `Cliente ${i}`,
        phone: `0414${String(i).padStart(7, '0')}`,
      }));

      const result = await importCustomersBatch(bigBatch);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('250');
      expect(mockCreate).not.toHaveBeenCalled();
    });
    it('returns error if user is not authenticated', async () => {
      mockAuth.mockResolvedValueOnce({ user: null });

      const result = await importCustomersBatch([{ name: 'Test', phone: '04141234567' }]);
      expect(result.success).toBe(false);
      expect(result.errors).toContain('No autenticado');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('skips invalid records and normalizes phones for valid ones', async () => {
      const mockUser = { id: 1, role: 'tenant-admin', tenants: [{ tenant: 10 }] };
      mockAuth.mockResolvedValueOnce({ user: mockUser });

      // First item: exists -> update
      // Second item: doesn't exist -> create
      mockFind
        .mockResolvedValueOnce({ docs: [{ id: 99, name: 'Viejo', notes: 'Nota vieja' }] })
        .mockResolvedValueOnce({ docs: [] });

      const batch = [
        { name: '', phone: '04141112233' }, // invalid name -> skip
        { name: 'Maria', phone: '123' }, // invalid phone -> skip
        { name: 'Carlos Gomez', phone: '0414-9998877', notes: 'Nota nueva' }, // valid -> update
        { name: 'Ana Silva', phone: '4241122334', email: 'ana@mail.com' }, // valid -> create
      ];

      const result = await importCustomersBatch(batch);

      expect(result.errors.length).toBe(2);
      expect(result.updatedCount).toBe(1);
      expect(result.createdCount).toBe(1);

      // Verify normalization: Carlos 0414-9998877 -> 584149998877 y tenant filter
      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            and: [
              { tenant: { equals: 10 } },
              {
                or: [
                  { phone: { equals: '584149998877' } },
                  { phone: { equals: '0414-9998877' } },
                ],
              },
            ],
          },
        })
      );

      // Verify create has tenant and tag nuevo
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'customers',
          data: expect.objectContaining({
            name: 'Ana Silva',
            phone: '584241122334',
            tag: 'nuevo',
            totalOrders: 0,
            totalSpent: 0,
            tenant: 10,
          }),
        })
      );
    });

    it('rejects import if user does not have access to explicit tenant', async () => {
      const mockUser = { id: 1, role: 'tenant-admin', tenants: [{ tenant: 10 }] };
      mockAuth.mockResolvedValueOnce({ user: mockUser });

      const result = await importCustomersBatch([{ name: 'Test', phone: '04141234567' }], 999);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('No estás autorizado');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('uses explicit tenant when user is authorized for multiple stores', async () => {
      const mockUser = { id: 1, role: 'tenant-admin', tenants: [{ tenant: 10 }, { tenant: 20 }] };
      mockAuth.mockResolvedValueOnce({ user: mockUser });
      mockFind.mockResolvedValueOnce({ docs: [] });

      const result = await importCustomersBatch([{ name: 'Pedro', phone: '04145556677' }], 20);
      expect(result.success).toBe(true);
      expect(result.createdCount).toBe(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant: 20,
          }),
        })
      );
    });
  });

  describe('updateCustomerNotes and updateCustomerTag', () => {
    it('updates notes with user and overrideAccess: false', async () => {
      const mockUser = { id: 1, role: 'tenant-admin', tenants: [{ tenant: 10 }] };
      mockAuth.mockResolvedValueOnce({ user: mockUser });

      const res = await updateCustomerNotes(5, 'Cliente preferencial de delivery');
      expect(res.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'customers',
          id: 5,
          data: { notes: 'Cliente preferencial de delivery' },
          overrideAccess: false,
          user: mockUser,
        })
      );
    });

    it('rejects invalid customer ID in updateCustomerNotes', async () => {
      const res = await updateCustomerNotes(-1, 'Nota');
      expect(res.success).toBe(false);
      expect(res.error).toBe('ID de cliente inválido');
    });

    it('updates tag with user and overrideAccess: false', async () => {
      const mockUser = { id: 1, role: 'tenant-admin', tenants: [{ tenant: 10 }] };
      mockAuth.mockResolvedValueOnce({ user: mockUser });

      const res = await updateCustomerTag(5, 'vip');
      expect(res.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'customers',
          id: 5,
          data: { tag: 'vip' },
          overrideAccess: false,
          user: mockUser,
        })
      );
    });

    it('rejects invalid tag in updateCustomerTag', async () => {
      const res = await updateCustomerTag(5, 'super_vip' as any);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Etiqueta de cliente inválida');
    });
  });

  describe('fetchCustomerOrders', () => {
    it('returns empty array when phone is invalid or too short', async () => {
      expect(await fetchCustomerOrders('')).toEqual([]);
      expect(await fetchCustomerOrders('123')).toEqual([]);
    });

    it('queries orders by phone normalized', async () => {
      const mockUser = { id: 1, role: 'tenant-admin', tenants: [{ tenant: 10 }] };
      mockAuth.mockResolvedValueOnce({ user: mockUser });
      mockFind.mockResolvedValueOnce({ docs: [{ id: 101, orderNumber: '1001', totalAmount: 45 }] });

      const orders = await fetchCustomerOrders('04141234567');
      expect(orders.length).toBe(1);
      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'orders',
          where: {
            or: [
              { 'customer.phone': { equals: '04141234567' } },
              { 'customer.phone': { equals: '584141234567' } },
              { 'customer.phone': { equals: '4141234567' } },
            ],
          },
        })
      );
    });
  });

  describe('getCustomerKpis SQL aggregation', () => {
    it('computes aggregated counts and average LTV correctly', async () => {
      mockDrizzleExecute.mockResolvedValueOnce({
        rows: [
          {
            total_customers: '50',
            vip_count: '10',
            recurrent_count: '15',
            new_count: '20',
            inactive_count: '5',
            total_spent_usd: '2500.50',
          },
        ],
      });

      const fakePayload = {
        db: {
          drizzle: {
            execute: mockDrizzleExecute,
          },
          tableNameMap: new Map([['customers', 'customers']]),
        },
      } as any;

      const kpis = await getCustomerKpis(fakePayload, 10);
      expect(kpis.totalCustomers).toBe(50);
      expect(kpis.vipCount).toBe(10);
      expect(kpis.recurrentCount).toBe(15);
      expect(kpis.newCount).toBe(20);
      expect(kpis.inactiveCount).toBe(5);
      expect(kpis.totalSpentUSD).toBe(2500.5);
      expect(kpis.averageLtv).toBeCloseTo(50.01, 2);
    });
  });
});

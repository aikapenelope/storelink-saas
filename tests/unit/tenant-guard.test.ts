import { describe, expect, it } from 'vitest';
import { APIError } from 'payload';
import {
  assertTenantMembership,
  createTenantWriteGuard,
  tenantIdFromValue,
} from '@/hooks/ensureTenantMembership';

/**
 * Tests unitarios del guard A1 (plan v2 R1). El helper es puro e inyectable
 * a propósito: se testea sin mock del runtime de Payload.
 */

const superAdmin = { id: 1, role: 'super-admin', tenants: [] };
const tenantAdminA = { id: 2, role: 'tenant-admin', tenants: [{ tenant: 10 }] };
const tenantAdminB = { id: 3, role: 'tenant-admin', tenants: [{ tenant: { id: 20 } }] };

describe('tenantIdFromValue', () => {
  it('normaliza id plano number/string', () => {
    expect(tenantIdFromValue(10)).toBe(10);
    expect(tenantIdFromValue('10')).toBe('10');
  });

  it('normaliza objeto poblado con id', () => {
    expect(tenantIdFromValue({ id: 42 })).toBe(42);
  });

  it('devuelve null para vacío o forma inválida', () => {
    expect(tenantIdFromValue(null)).toBeNull();
    expect(tenantIdFromValue(undefined)).toBeNull();
    expect(tenantIdFromValue({})).toBeNull();
  });
});

describe('assertTenantMembership', () => {
  it('tenant-admin puede escribir en SU tenant (id plano)', () => {
    expect(assertTenantMembership(tenantAdminA, 10)).toBe(true);
  });

  it('tenant-admin puede escribir en su tenant poblado como objeto', () => {
    expect(assertTenantMembership(tenantAdminB, { id: 20 })).toBe(true);
  });

  it('cross-tenant → denegado (hallazgo A1)', () => {
    expect(assertTenantMembership(tenantAdminA, 20)).toBe(false);
  });

  it('super-admin pasa siempre', () => {
    expect(assertTenantMembership(superAdmin, 999)).toBe(true);
  });

  it('anónimo pasa (ruta interna de confianza ya gateada por access)', () => {
    expect(assertTenantMembership(null, 20)).toBe(true);
  });

  it('sin tenant explícito pasa (el defaultValue oficial del plugin auto-asigna)', () => {
    expect(assertTenantMembership(tenantAdminA, undefined)).toBe(true);
    expect(assertTenantMembership(tenantAdminA, null)).toBe(true);
  });
});

describe('createTenantWriteGuard (hook de colección)', () => {
  const hook = createTenantWriteGuard();

  it('devuelve data intacta cuando la membresía es válida', async () => {
    const data = { title: 'Pizza', tenant: 10 };
    await expect(
      hook({ data, req: { user: tenantAdminA } } as never)
    ).resolves.toBe(data);
  });

  it('lanza APIError 403 en escritura cross-tenant', async () => {
    try {
      await hook({ data: { title: 'X', tenant: 20 }, req: { user: tenantAdminA } } as never);
      expect.unreachable('debía lanzar');
    } catch (err) {
      expect(err).toBeInstanceOf(APIError);
      expect((err as APIError).status).toBe(403);
    }
  });

  it('update parcial SIN tenant explícito no se bloquea', async () => {
    const data = { price: 5 };
    await expect(hook({ data, req: { user: tenantAdminA } } as never)).resolves.toBe(data);
  });

  it('update que REASIGNA a tenant ajeno se bloquea (mover documento)', async () => {
    await expect(
      hook({ data: { tenant: 20 }, req: { user: tenantAdminA }, originalDoc: { tenant: 10 } } as never)
    ).rejects.toThrow(APIError);
  });
});

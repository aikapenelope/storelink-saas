import { describe, expect, it } from 'vitest';
import {
  checkoutIntentStorageKey,
  clearCheckoutIntentToken,
  getOrCreateCheckoutIntentToken,
  readCheckoutIntentToken,
} from '@/lib/checkout-intent-token';

/**
 * Tests del ciclo de vida del token de intención (review Devin #74, 2ª ronda:
 * "Persist the checkout intent token with the tenant's cart").
 *
 * Cubre los dos escenarios que exigía Devin:
 *  - RELOAD: nueva llamada con el mismo storage → MISMO token.
 *  - SEGUNDA PESTAÑA: dos facades de Storage sobre el mismo origen (mismo
 *    backing store, como el localStorage real compartido entre pestañas) →
 *    MISMO token mientras el carrito representa la misma compra.
 */

class InMemoryStorage implements Storage {
  private backing: Map<string, string>;
  constructor(shared?: Map<string, string>) {
    this.backing = shared ?? new Map<string, string>();
  }
  get length(): number {
    return this.backing.size;
  }
  clear(): void {
    this.backing.clear();
  }
  getItem(key: string): string | null {
    return this.backing.has(key) ? (this.backing.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.backing.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.backing.delete(key);
  }
  setItem(key: string, value: string): void {
    this.backing.set(key, value);
  }
}

const TENANT = 'donluigi';

describe('checkout intent token — persistencia con el carrito', () => {
  it('RELOAD: el mismo storage devuelve el mismo token en llamadas sucesivas', () => {
    const storage = new InMemoryStorage();
    const first = getOrCreateCheckoutIntentToken(storage, TENANT);
    const reloaded = getOrCreateCheckoutIntentToken(storage, TENANT);
    expect(reloaded).toBe(first);
    expect(readCheckoutIntentToken(storage, TENANT)).toBe(first);
  });

  it('SEGUNDA PESTAÑA: dos facades sobre el mismo origen comparten el token', () => {
    const sharedBacking = new Map<string, string>(); // localStorage del origen
    const tabA = new InMemoryStorage(sharedBacking);
    const tabB = new InMemoryStorage(sharedBacking);

    const tokenA = getOrCreateCheckoutIntentToken(tabA, TENANT);
    // La pestaña B (sin haber generado nada) lee el MISMO token persistido:
    // su reintento recae en la MISMA reserva de idempotencia.
    const tokenB = getOrCreateCheckoutIntentToken(tabB, TENANT);
    expect(tokenB).toBe(tokenA);
  });

  it('ROTACIÓN: tras clear (resultado terminal / compra nueva), el próximo token es distinto', () => {
    const storage = new InMemoryStorage();
    const first = getOrCreateCheckoutIntentToken(storage, TENANT);
    clearCheckoutIntentToken(storage, TENANT);
    expect(readCheckoutIntentToken(storage, TENANT)).toBeNull();
    const second = getOrCreateCheckoutIntentToken(storage, TENANT);
    expect(second).not.toBe(first);
  });

  it('un token corrupto en storage se regenera (nunca llega un token inválido al server)', () => {
    const storage = new InMemoryStorage();
    storage.setItem(checkoutIntentStorageKey(TENANT), 'con espacios <malicioso>');
    const token = getOrCreateCheckoutIntentToken(storage, TENANT);
    expect(token).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(readCheckoutIntentToken(storage, TENANT)).toBe(token);
  });

  it('tenants distintos tienen tokens independientes (claves namespaced)', () => {
    const storage = new InMemoryStorage();
    const a = getOrCreateCheckoutIntentToken(storage, 'donluigi');
    const b = getOrCreateCheckoutIntentToken(storage, 'motozone');
    expect(a).not.toBe(b);
    expect(readCheckoutIntentToken(storage, 'donluigi')).toBe(a);
    expect(readCheckoutIntentToken(storage, 'motozone')).toBe(b);
  });

  it('sin storage disponible (modo privado): token efímero de sesión, sin lanzar', () => {
    const token = getOrCreateCheckoutIntentToken(null, TENANT);
    expect(token).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    // Clear/read sin storage tampoco lanzan.
    expect(() => clearCheckoutIntentToken(null, TENANT)).not.toThrow();
    expect(readCheckoutIntentToken(null, TENANT)).toBeNull();
  });
});
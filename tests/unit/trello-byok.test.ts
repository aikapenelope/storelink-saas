import { describe, expect, it } from 'vitest';
import { resolveTrelloCredentials } from '@/lib/trello';

/**
 * resolveTrelloCredentials: BYOK por tenant (mismo patrón que el adapter
 * multi-tenant de Resend) con fallback a la cuenta maestra global. Helper
 * puro, sin runtime de Payload — análogo a los tests de
 * findVariantIndexBySku en tests/unit/order-inventory.test.ts.
 */
describe('resolveTrelloCredentials', () => {
  const master = { apiKey: 'MASTER_KEY', token: 'MASTER_TOKEN' };

  it('usa el BYOK del tenant cuando trae AMBOS apiKey y token propios', () => {
    const result = resolveTrelloCredentials(
      { apiKey: 'TENANT_KEY', token: 'TENANT_TOKEN' },
      master
    );
    expect(result).toEqual({ apiKey: 'TENANT_KEY', token: 'TENANT_TOKEN' });
  });

  it('cae a la cuenta maestra si el tenant no configuró nada', () => {
    const result = resolveTrelloCredentials(undefined, master);
    expect(result).toEqual({ apiKey: 'MASTER_KEY', token: 'MASTER_TOKEN' });
  });

  it('cae a la cuenta maestra si el tenant no configuró trelloConfig', () => {
    const result = resolveTrelloCredentials(null, master);
    expect(result).toEqual({ apiKey: 'MASTER_KEY', token: 'MASTER_TOKEN' });
  });

  it('descarta un BYOK parcial (solo apiKey, sin token) y usa la cuenta maestra completa', () => {
    const result = resolveTrelloCredentials({ apiKey: 'TENANT_KEY' }, master);
    expect(result).toEqual({ apiKey: 'MASTER_KEY', token: 'MASTER_TOKEN' });
  });

  it('descarta un BYOK parcial (solo token, sin apiKey) y usa la cuenta maestra completa', () => {
    const result = resolveTrelloCredentials({ token: 'TENANT_TOKEN' }, master);
    expect(result).toEqual({ apiKey: 'MASTER_KEY', token: 'MASTER_TOKEN' });
  });

  it('devuelve strings vacíos si ni el tenant ni la cuenta maestra tienen credenciales', () => {
    const result = resolveTrelloCredentials(undefined, { apiKey: undefined, token: undefined });
    expect(result).toEqual({ apiKey: '', token: '' });
  });
});

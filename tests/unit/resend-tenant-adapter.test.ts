import { describe, expect, it, vi } from 'vitest';
import type { Payload } from 'payload';
import {
  mapAddresses,
  mapAttachments,
  mapFromAddress,
  mapHeaders,
  mapPayloadEmailToResendEmail,
  resolveApiKey,
} from '@/lib/email/resend-tenant-adapter';

/**
 * Tests del adapter multi-tenant de Resend (auditoría BYOK 2026-08-29,
 * hallazgo F5): el adapter nunca tuvo cobertura de tests, a diferencia de
 * resolveTrelloCredentials (tests/unit/trello-byok.test.ts). Estos tests
 * cubren la resolución de credenciales (con cache) y los mappers a la API
 * de Resend, verificados contra el código real de
 * @payloadcms/email-resend@3.88.0 instalado en node_modules (no solo contra
 * su firma pública) — ver comentarios de mapAddresses en el archivo fuente.
 */
describe('mapFromAddress', () => {
  it('usa defaultFromName + defaultFromAddress sin address', () => {
    expect(mapFromAddress(undefined, 'Flow Notificaciones', 'pedidos@flow.martes.app')).toBe(
      'Flow Notificaciones <pedidos@flow.martes.app>'
    );
  });

  it('pasa el string tal cual', () => {
    expect(mapFromAddress('Tienda X <x@tienda.com>', 'Flow', 'default@x.com')).toBe(
      'Tienda X <x@tienda.com>'
    );
  });

  it('usa el name del objeto Address si viene', () => {
    expect(mapFromAddress({ name: 'Don Luigi', address: 'pedidos@donluigi.com' }, 'Flow', 'd@x.com')).toBe(
      'Don Luigi <pedidos@donluigi.com>'
    );
  });

  it('cae a defaultFromName si el objeto Address no trae name (mejora deliberada sobre el adapter oficial)', () => {
    expect(mapFromAddress({ address: 'pedidos@donluigi.com' }, 'Flow Notificaciones', 'd@x.com')).toBe(
      'Flow Notificaciones <pedidos@donluigi.com>'
    );
  });
});

describe('mapAddresses', () => {
  it('devuelve string vacío sin addresses', () => {
    expect(mapAddresses(undefined)).toBe('');
  });

  it('pasa el string tal cual', () => {
    expect(mapAddresses('cliente@test.com')).toBe('cliente@test.com');
  });

  it('devuelve un ARRAY de strings para un array de strings (alineado con el adapter oficial)', () => {
    expect(mapAddresses(['a@x.com', 'b@x.com'])).toEqual(['a@x.com', 'b@x.com']);
  });

  it('devuelve un ARRAY de strings para un array de objetos Address', () => {
    expect(mapAddresses([{ address: 'a@x.com' }, { address: 'b@x.com' }])).toEqual(['a@x.com', 'b@x.com']);
  });

  it('devuelve un array de 1 elemento para un objeto Address único (igual que el adapter oficial)', () => {
    expect(mapAddresses({ name: 'Cliente', address: 'cliente@test.com' })).toEqual(['cliente@test.com']);
  });

  it('no lanza con un objeto Address sin address', () => {
    expect(mapAddresses({ name: 'Sin correo' })).toEqual(['']);
  });
});

describe('mapAttachments', () => {
  it('devuelve [] sin attachments', () => {
    expect(mapAttachments(undefined)).toEqual([]);
  });

  it('lanza si falta filename', () => {
    expect(() => mapAttachments([{ content: 'abc' }])).toThrow('Attachment is missing filename');
  });

  it('lanza si falta content y path', () => {
    expect(() => mapAttachments([{ filename: 'nota.pdf' }])).toThrow(
      'Attachment is missing both content and path'
    );
  });

  it('usa path (string) cuando no hay content', () => {
    expect(mapAttachments([{ filename: 'nota.pdf', path: 'https://r2.example/nota.pdf' }])).toEqual([
      { filename: 'nota.pdf', path: 'https://r2.example/nota.pdf' },
    ]);
  });

  it('resuelve path como objeto {href}', () => {
    expect(
      mapAttachments([{ filename: 'nota.pdf', path: { href: 'https://r2.example/nota.pdf' } }])
    ).toEqual([{ filename: 'nota.pdf', path: 'https://r2.example/nota.pdf' }]);
  });

  it('usa content cuando viene', () => {
    expect(mapAttachments([{ filename: 'nota.pdf', content: 'base64abc' }])).toEqual([
      { filename: 'nota.pdf', content: 'base64abc' },
    ]);
  });
});

describe('mapHeaders', () => {
  it('devuelve undefined sin headers', () => {
    expect(mapHeaders(undefined)).toBeUndefined();
  });

  it('mapea la forma array-de-objetos', () => {
    expect(mapHeaders([{ key: 'X-Test', value: '1' }])).toEqual({ 'X-Test': '1' });
  });

  it('mapea la forma objeto con valores string/array/{value}', () => {
    expect(
      mapHeaders({
        'X-String': 'a',
        'X-Array': ['a', 'b'],
        'X-Prepared': { prepared: true, value: 'c' },
      })
    ).toEqual({ 'X-String': 'a', 'X-Array': 'a, b', 'X-Prepared': 'c' });
  });
});

describe('mapPayloadEmailToResendEmail', () => {
  it('omite bcc/cc/reply_to cuando no vienen (no manda strings vacíos a Resend)', () => {
    const result = mapPayloadEmailToResendEmail(
      { to: 'cliente@test.com', subject: 'Hola', html: '<p>hi</p>' },
      'Flow',
      'default@x.com'
    );
    expect(result.bcc).toBeUndefined();
    expect(result.cc).toBeUndefined();
    expect(result.reply_to).toBeUndefined();
    expect(result.to).toBe('cliente@test.com');
  });
});

describe('resolveApiKey', () => {
  const masterKey = 'MASTER_KEY';

  function mockPayload(findImpl: (...args: unknown[]) => unknown): Payload {
    return { find: vi.fn(findImpl) } as unknown as Payload;
  }

  it('usa la clave BYOK del tenant cuando existe emailConfig.resendApiKey', async () => {
    const payload = mockPayload(() => ({
      docs: [{ emailConfig: { resendApiKey: 'TENANT_KEY' } }],
    }));
    const key = await resolveApiKey('tenant-a@test.com', payload, masterKey);
    expect(key).toBe('TENANT_KEY');
  });

  it('cae a la clave master si el tenant no configuró resendApiKey', async () => {
    const payload = mockPayload(() => ({ docs: [{ emailConfig: {} }] }));
    const key = await resolveApiKey('tenant-b@test.com', payload, masterKey);
    expect(key).toBe(masterKey);
  });

  it('cae a la clave master si no hay ningún tenant con ese fromEmail', async () => {
    const payload = mockPayload(() => ({ docs: [] }));
    const key = await resolveApiKey('sin-match@test.com', payload, masterKey);
    expect(key).toBe(masterKey);
  });

  it('cae a la clave master (fail-safe) si la query falla', async () => {
    const payload = mockPayload(() => {
      throw new Error('DB caída');
    });
    const key = await resolveApiKey('tenant-c@test.com', payload, masterKey);
    expect(key).toBe(masterKey);
  });

  it('cachea el resultado: la segunda llamada con el mismo fromAddress no repite la query', async () => {
    const findMock = vi.fn(() => ({ docs: [{ emailConfig: { resendApiKey: 'TENANT_KEY_CACHED' } }] }));
    const payload = { find: findMock } as unknown as Payload;

    const first = await resolveApiKey('tenant-cache@test.com', payload, masterKey);
    const second = await resolveApiKey('tenant-cache@test.com', payload, masterKey);

    expect(first).toBe('TENANT_KEY_CACHED');
    expect(second).toBe('TENANT_KEY_CACHED');
    expect(findMock).toHaveBeenCalledTimes(1);
  });
});

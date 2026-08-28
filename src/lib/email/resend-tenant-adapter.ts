import type { EmailAdapter, Payload } from 'payload';

type Address = { name?: string; address?: string };

/**
 * Adapter de email oficial (interfaz EmailAdapter de Payload:
 * https://payloadcms.com/docs/email/overview) multi-tenant para Resend.
 * Cada tenant puede usar SU propia clave Resend (tenants.emailConfig.
 * resendApiKey); si no la tiene, se usa la clave master (RESEND_API_KEY).
 * La resolución es por el `from` (address) de cada envío: el job de checkout
 * manda `from: { name: storeName, address: fromEmail }` y el adapter localiza
 * al tenant por ese fromEmail. El mapeo a la API de Resend replica el del
 * adapter oficial @payloadcms/email-resend (única diferencia: la clave).
 *
 * Sprint 3 (M1): cache en memoria por fromAddress con TTL de 5 minutos.
 * Sin cache, cada email (cliente + comercio + reintentos del job) hacía
 * 1 query a la BD para resolver la API key. Con cache: 0 queries en caliente.
 * El módulo-level Map persiste entre invocaciones dentro de la misma instancia
 * serverless (patrón singleton ya usado en exchange-rate.ts y rate-limit.ts).
 */
type ResendTenantAdapterArgs = {
  defaultFromAddress: string;
  defaultFromName: string;
  apiKey: string;
};

type ResendResponse = { id: string } | { message: string; name: string; statusCode: number };

/** Cache en módulo: from address → { key, expiresAt }. TTL 5 minutos. */
const tenantKeyCache = new Map<string, { key: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Resuelve la API key del tenant por fromEmail, con cache de 5 min. */
async function resolveApiKey(fromAddress: string, payload: Payload, masterKey: string): Promise<string> {
  const now = Date.now();
  const cached = tenantKeyCache.get(fromAddress);
  if (cached && cached.expiresAt > now) return cached.key;

  try {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { 'emailConfig.fromEmail': { equals: fromAddress } },
      limit: 1,
      overrideAccess: true,
      // Seleccionar solo el campo necesario para minimizar payload de la query
      select: { emailConfig: { resendApiKey: true } } as never,
    });
    const tenantKey = (tenants.docs[0] as { emailConfig?: { resendApiKey?: string } } | undefined)
      ?.emailConfig?.resendApiKey;
    const resolvedKey = tenantKey || masterKey;
    tenantKeyCache.set(fromAddress, { key: resolvedKey, expiresAt: now + CACHE_TTL_MS });
    return resolvedKey;
  } catch (err) {
    console.warn('resend-tenant: no se pudo resolver tenant, se usa la clave master:', err);
    // No cachear los errores — el próximo intento volverá a intentar la query
    return masterKey;
  }
}

export const resendTenantAdapter = (
  args: ResendTenantAdapterArgs
): EmailAdapter<ResendResponse> =>
  ({ payload }: { payload: Payload }) => ({
    defaultFromAddress: args.defaultFromAddress,
    defaultFromName: args.defaultFromName,
    name: 'resend-tenant',
    sendEmail: async (message) => {
      // Extraer solo el email de un string con formato "Name <email@domain.com>".
      // Payload y los jobs pasan `from` como esa cadena completa; si la pasamos
      // tal cual al lookup, la query busca el nombre+email completo y nunca
      // matchea con emailConfig.fromEmail (que almacena solo la dirección).
      const rawFrom = typeof message.from === 'string' ? message.from : message.from?.address;
      const fromAddress = rawFrom
        ? (rawFrom.match(/<([^>]+)>/)?.[1] ?? rawFrom).trim()
        : undefined;

      // Sprint 3: lookup con cache — 0 queries a BD cuando el cache está caliente
      const apiKey = fromAddress
        ? await resolveApiKey(fromAddress, payload, args.apiKey)
        : args.apiKey;

      const sendEmailOptions = mapPayloadEmailToResendEmail(
        message,
        args.defaultFromName,
        args.defaultFromAddress
      );

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sendEmailOptions),
        // R3 (plan v2): timeout duro; el job reintenta (3 attempts/backoff).
        signal: AbortSignal.timeout(10000),
      });

      const data = (await res.json()) as ResendResponse;
      if ('id' in data) {
        return data;
      }
      const statusCode = data.statusCode || res.status;
      throw new Error(`Error sending email: ${statusCode}`);
    },
  });

function mapPayloadEmailToResendEmail(
  message: { from?: Address | string; to?: Address | Address[] | string; subject?: string; html?: unknown; text?: unknown; cc?: Address | Address[] | string; bcc?: Address | Address[] | string; replyTo?: Address | Address[] | string; attachments?: unknown[]; headers?: unknown },
  defaultFromName: string,
  defaultFromAddress: string
) {
  return {
    from: mapFromAddress(message.from, defaultFromName, defaultFromAddress),
    subject: message.subject ?? '',
    to: mapAddresses(message.to),
    bcc: mapAddresses(message.bcc) || undefined,
    cc: mapAddresses(message.cc) || undefined,
    reply_to: mapAddresses(message.replyTo) || undefined,
    attachments: mapAttachments(message.attachments),
    headers: mapHeaders(message.headers),
    html: message.html?.toString() || '',
    text: message.text?.toString() || '',
  };
}

function mapFromAddress(
  address: Address | string | undefined,
  defaultFromName: string,
  defaultFromAddress: string
): string {
  if (!address) {
    return `${defaultFromName} <${defaultFromAddress}>`;
  }
  if (typeof address === 'string') {
    return address;
  }
  return `${address.name ?? defaultFromName} <${address.address}>`;
}

function mapAddresses(addresses?: Address | Address[] | string): string {
  if (!addresses) {
    return '';
  }
  if (typeof addresses === 'string') {
    return addresses;
  }
  if (Array.isArray(addresses)) {
    return addresses.map((a) => (typeof a === 'string' ? a : a.address)).join(', ');
  }
  return addresses.address ?? '';
}

function mapAttachments(attachments?: unknown[]): unknown[] {
  if (!attachments) {
    return [];
  }
  return attachments.map((raw) => {
    const attachment = raw as { filename?: string; content?: string; path?: string | { href: string } };
    if (!attachment.filename) {
      throw new Error('Attachment is missing filename');
    }
    if (!attachment.content && !attachment.path) {
      throw new Error('Attachment is missing both content and path');
    }
    if (attachment.path && !attachment.content) {
      const path = typeof attachment.path === 'string' ? attachment.path : attachment.path.href;
      return {
        filename: attachment.filename,
        path,
      };
    }
    return {
      filename: attachment.filename,
      content: attachment.content,
    };
  });
}

function mapHeaders(headers?: unknown): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }
  if (Array.isArray(headers)) {
    return headers.reduce((acc: Record<string, string>, { key, value }: { key: string; value: string }) => {
      acc[key] = value;
      return acc;
    }, {});
  }
  return Object.entries(headers as Record<string, string | string[] | { prepared: boolean; value: string }>).reduce(
    (acc, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = value;
      } else if (Array.isArray(value)) {
        acc[key] = value.join(', ');
      } else {
        acc[key] = value.value;
      }
      return acc;
    },
    {} as Record<string, string>
  );
}
import type { EmailAdapter, Payload } from 'payload';
import { APIError } from 'payload';

export type Address = { name?: string; address?: string };

/**
 * Adapter de email oficial (interfaz EmailAdapter de Payload:
 * https://payloadcms.com/docs/email/overview) multi-tenant para Resend.
 * Cada tenant puede usar SU propia clave Resend (tenants.emailConfig.
 * resendApiKey); si no la tiene, se usa la clave master (RESEND_API_KEY).
 * La resolución es por el `from` (address) de cada envío: el job de checkout
 * manda `from: { name: storeName, address: fromEmail }` y el adapter localiza
 * al tenant por ese fromEmail. `emailConfig.fromEmail` es único a nivel de BD
 * (migración 20260830_tenants_from_email_unique.ts + validate en Tenants.ts)
 * — sin esa restricción, dos tenants con el mismo fromEmail se prestarían
 * silenciosamente la clave de Resend entre sí (F1, auditoría BYOK 2026-08-29).
 *
 * El mapeo a la API de Resend se verificó línea por línea contra el código
 * REAL instalado de @payloadcms/email-resend@3.88.0 (no solo contra su
 * firma pública) — ver mapAddresses más abajo para la única divergencia de
 * comportamiento que tenía este adapter y ya se corrigió.
 *
 * Sprint 3 (M1): cache en memoria por fromAddress con TTL de 5 minutos.
 * Sin cache, cada email (cliente + comercio + reintentos del job) hacía
 * 1 query a la BD para resolver la API key. Con cache: 0 queries en caliente.
 * El módulo-level Map persiste entre invocaciones dentro de la misma instancia
 * serverless (patrón singleton ya usado en exchange-rate.ts y rate-limit.ts).
 */
export type ResendTenantAdapterArgs = {
  defaultFromAddress: string;
  defaultFromName: string;
  apiKey: string;
  /**
   * P2 (auditoría BYOK 2026-08-29): mismo safety net que ya trae el adapter
   * oficial @payloadcms/email-resend (`overrideRecipientAddress`). Si se
   * define, TODO correo (de cualquier tenant) se redirige a esta dirección
   * — pensado para Vercel Preview/staging, para no mandar confirmaciones
   * reales a clientes si algún día se prueba un checkout completo ahí.
   * Configurar solo vía RESEND_OVERRIDE_RECIPIENT en entornos no-productivos;
   * NUNCA en producción (ver src/payload.config.ts).
   */
  overrideRecipientAddress?: string;
};

type ResendResponse = { id: string } | { message: string; name: string; statusCode: number };

/** Cache en módulo: from address → { key, expiresAt }. TTL 5 minutos. */
const tenantKeyCache = new Map<string, { key: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Resuelve la API key del tenant por fromEmail, con cache de 5 min. */
export async function resolveApiKey(fromAddress: string, payload: Payload, masterKey: string): Promise<string> {
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

      // P2: mismo patrón que el adapter oficial — override total del
      // destinatario en entornos no-productivos (ver ResendTenantAdapterArgs).
      const modifiedMessage = args.overrideRecipientAddress
        ? { ...message, to: args.overrideRecipientAddress }
        : message;

      const sendEmailOptions = mapPayloadEmailToResendEmail(
        modifiedMessage,
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
      // P3 (auditoría BYOK 2026-08-29): alineado con el adapter oficial —
      // incluye name/message de Resend en el error. Antes solo se veía el
      // status code en los logs de Vercel, sin el detalle real del fallo
      // (ej. "validation_error - Invalid `from` field"). También se usa
      // APIError (como el resto del repo, ver Orders.ts) en vez de Error
      // plano, para que el status HTTP real de Resend viaje con el error.
      let formattedError = `Error sending email: ${statusCode}`;
      if (data.name && data.message) {
        formattedError += ` ${data.name} - ${data.message}`;
      }
      throw new APIError(formattedError, statusCode);
    },
  });

/** Forma real de nodemailer (de la que Payload extiende SendEmailOptions): un destinatario, uno solo, o una mezcla de strings y objetos Address. */
type AddressOrAddresses = Address | (Address | string)[] | string;

export function mapPayloadEmailToResendEmail(
  message: { from?: Address | string; to?: AddressOrAddresses; subject?: string; html?: unknown; text?: unknown; cc?: AddressOrAddresses; bcc?: AddressOrAddresses; replyTo?: AddressOrAddresses; attachments?: unknown[]; headers?: unknown },
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

/**
 * Divergencia INTENCIONAL del adapter oficial: éste usa `address.name` tal
 * cual (podría renderizar "undefined <email>" si el remitente no trae
 * nombre). Aquí se cae a `defaultFromName` en ese caso — mejora deliberada,
 * no un bug, y por eso NO se "alinea" con el oficial en este punto.
 */
export function mapFromAddress(
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

/**
 * P2 (auditoría BYOK 2026-08-29): alineado con el mapAddresses REAL del
 * adapter oficial instalado (@payloadcms/email-resend/dist/index.js) —
 * devuelve un ARRAY de strings para arrays/objetos Address, nunca un string
 * unido con comas. Antes de este fix, un `to`/`cc`/`bcc` con múltiples
 * destinatarios (array) se mandaba a Resend como "a@x.com, b@x.com" (string)
 * en vez de ["a@x.com", "b@x.com"] (array) — el comentario original de este
 * archivo afirmaba que el mapeo "replica el del adapter oficial", pero esa
 * afirmación era incorrecta en este punto. Hoy la app solo manda strings
 * simples (nunca arrays) en `to`/`cc`/`bcc`, así que el fix no cambia
 * comportamiento observable todavía, pero cierra la divergencia antes de
 * que algún día se necesite mandar a múltiples destinatarios.
 */
export function mapAddresses(addresses?: AddressOrAddresses): string | string[] {
  if (!addresses) {
    return '';
  }
  if (typeof addresses === 'string') {
    return addresses;
  }
  if (Array.isArray(addresses)) {
    return addresses.map((a) => (typeof a === 'string' ? a : a.address ?? ''));
  }
  return [addresses.address ?? ''];
}

export function mapAttachments(attachments?: unknown[]): unknown[] {
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

export function mapHeaders(headers?: unknown): Record<string, string> | undefined {
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

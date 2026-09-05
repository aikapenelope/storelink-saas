import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Tipo exacto de cliente que espera getSignedUrl (el presigner tipa contra su
 * propia copia de @aws-sdk/types). AWS SDK v3 separa la clase base Client por
 * copia de tipos (campos privados), por eso TS no ve asignable S3Client:
 * cast tipado al tipo real del contrato, documentado.
 */
type SignedUrlClient = Parameters<typeof getSignedUrl>[0];

/**
 * Notas de Entrega en R2 (Cloudflare) con URLs firmadas (presigned).
 * Patrón oficial de S3/R2: el PDF se genera UNA vez por pedido en el
 * checkout, se sube a R2 y cada descarga usa una URL firmada con expiración —
 * sin endpoints de Next ni regeneración por descarga. La firma es local
 * (getSignedUrl), sin costo de red ni runs adicionales.
 */

// Máximo permitido por firma sigv4 de S3/R2: 7 días (no se puede 30).
const DELIVERY_NOTE_TTL_SECONDS = 7 * 24 * 60 * 60;

// Descarga interactiva admin: la URL se genera fresca por request, así que
// un TTL corto basta. Los links que viajan al cliente (WhatsApp/email)
// conservan el TTL por defecto porque deben sobrevivir horas o días.
export const ADMIN_DOWNLOAD_TTL_SECONDS = 15 * 60;

let client: S3Client | null = null;

function r2Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
  }
  return client;
}

function keyFor(orderNumber: string): string {
  return `delivery-notes/${orderNumber}.pdf`;
}

export async function uploadDeliveryNotePdf(
  orderNumber: string,
  pdfBytes: Uint8Array
): Promise<boolean> {
  try {
    await r2Client().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: keyFor(orderNumber),
        Body: pdfBytes,
        ContentType: 'application/pdf',
        CacheControl: 'private, max-age=604800',
      })
    );
    return true;
  } catch (err) {
    console.error('R2 upload delivery note failed:', err);
    return false;
  }
}

export async function getDeliveryNoteUrl(
  orderNumber: string,
  expiresInSeconds = DELIVERY_NOTE_TTL_SECONDS
): Promise<string | null> {
  // Auditoría final 2026-09-01 (CRÍTICO): las Notas de Entrega SIEMPRE se
  // sirven con URL firmada, nunca por la URL pública del bucket. La key es
  // enumerable (delivery-notes/YYMMDD-NNNNNN.pdf) y el PDF contiene PII
  // completa del cliente (nombre, teléfono, dirección, pago): si el bucket
  // tiene acceso público (R2_PUBLIC_URL, que usa el plugin de media para las
  // imágenes de producto), las notas quedaban expuestas a enumeración
  // cross-tenant. Media sigue usando la URL pública (imágenes públicas por
  // diseño); delivery-notes NO.
  try {
    // AWS SDK v3 separa la clase base Client por copia de @aws-sdk/types
    // (campos privados), así que TS no ve asignable S3Client a Client aunque
    // sea la misma familia y versión en runtime — cast tipado documentado.
    return await getSignedUrl(
      r2Client() as unknown as SignedUrlClient,
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: keyFor(orderNumber),
        ResponseContentType: 'application/pdf',
      }),
      { expiresIn: expiresInSeconds }
    );
  } catch (err) {
    console.error('R2 presign delivery note failed:', err);
    return null;
  }
}
// ---------------------------------------------------------------------------
// Derecho al olvido y retención (auditoría 2026-09-04, P1-12): los PDF de
// Notas de Entrega contienen PII (nombre, teléfono, dirección) y antes vivían
// en R2 indefinidamente — la URL firmada expira, el objeto no.
// ---------------------------------------------------------------------------


/** Retención máxima de Notas de Entrega (regulatory-safe para Venezuela; sin ley integral de datos, 180d es el estándar conservador de e-commerce). */
export const DELIVERY_NOTE_RETENTION_DAYS = 180;

function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET
  );
}

/** Borra el PDF de una Nota de Entrega (usado por la anonimización de clientes). */
export async function deleteDeliveryNotePdf(orderNumber: string): Promise<boolean> {
  if (!r2Configured()) return false;
  try {
    await r2Client().send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: keyFor(orderNumber),
      })
    );
    return true;
  } catch (err) {
    console.error('R2 delete delivery note failed:', err);
    return false;
  }
}

/**
 * Purga masiva de Notas de Entrega más viejas que `maxAgeDays`. Best-effort:
 * R2 (S3 API) no soporta List con filtro de fecha, así que lista por prefijo
 * y borra por lotes las que superan la retención. Corre diaria vía
 * /api/admin/purge-delivery-notes (workflow jobs-daily.yml, cron-protected).
 */
export async function purgeOldDeliveryNotes(
  maxAgeDays: number = DELIVERY_NOTE_RETENTION_DAYS
): Promise<{ purged: number; skipped: boolean }> {
  if (!r2Configured()) {
    return { purged: 0, skipped: true };
  }

  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  let purged = 0;
  let continuationToken: string | undefined;

  try {
    do {
      const listed = await r2Client().send(
        new ListObjectsV2Command({
          Bucket: process.env.R2_BUCKET,
          Prefix: 'delivery-notes/',
          MaxKeys: 1000,
          ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
        })
      );

      const expired = (listed.Contents ?? [])
        .filter((obj) => obj.Key && obj.LastModified && obj.LastModified < cutoff)
        .map((obj) => ({ Key: obj.Key as string }));

      // DeleteObjects acepta lotes de hasta 1000 keys.
      for (let i = 0; i < expired.length; i += 1000) {
        const batch = expired.slice(i, i + 1000);
        await r2Client().send(
          new DeleteObjectsCommand({
            Bucket: process.env.R2_BUCKET,
            Delete: { Objects: batch, Quiet: true },
          })
        );
        purged += batch.length;
      }

      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);

    if (purged > 0) {
      console.log(`[storelink][privacy] delivery-notes >${maxAgeDays}d purgadas: ${purged}`);
    }
    return { purged, skipped: false };
  } catch (err) {
    console.error('R2 purge old delivery notes failed:', err);
    return { purged, skipped: false };
  }
}

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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
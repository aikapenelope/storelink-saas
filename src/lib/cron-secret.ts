import { timingSafeEqual } from 'crypto';

/**
 * Verificación timing-safe del secreto del runner externo (header x-cron-
 * secret). Extraída del inline de payload.config (jobs.access.run) para
 * reutilizarla en /api/admin/cleanup-jobs sin duplicar la comparación.
 * Con crypto.timingSafeEqual se evita filtrar el secreto por diferencias de
 * tiempo medibles; la comprobación previa de longitudes es requisito de la
 * propia API de Node y además corta temprano los intentos de sondeo.
 */
export function verifyCronSecret(provided: string | null | undefined): boolean {
  if (!provided) return false;
  const expected = process.env.CRON_SECRET ?? '';
  if (!expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

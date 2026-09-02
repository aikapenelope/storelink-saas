import { describe, it, expect } from 'vitest';
import {
  ALLOWED_IMAGE_HOST_SUFFIXES,
  isAllowedImageHostname,
  isAllowedImageUrl,
  normalizeProductImageUrl,
} from '@/lib/image-hosts';

describe('image-hosts whitelist', () => {
  it('acepta hosts exactos de la whitelist', () => {
    expect(isAllowedImageHostname('images.unsplash.com')).toBe(true);
  });

  it('acepta subdominios de los sufijos permitidos', () => {
    expect(isAllowedImageHostname('xyz.supabase.co')).toBe(true);
    expect(isAllowedImageHostname('abc.r2.cloudflarestorage.com')).toBe(true);
    expect(isAllowedImageHostname('mi-app.vercel.app')).toBe(true);
  });

  it('rechaza hosts ajenos no listados (caso real: Google Drive visor HTML, sitios no CDN)', () => {
    expect(isAllowedImageHostname('drive.google.com')).toBe(false);
    expect(isAllowedImageHostname('dropbox.com')).toBe(false);
    expect(isAllowedImageHostname('evil.com')).toBe(false);
  });

  it('acepta nuevos CDNs permitidos (R2 público, martes.app, Google CDN, Cloudinary, Imgur, Shopify)', () => {
    expect(isAllowedImageHostname('pub-12345.r2.dev')).toBe(true);
    expect(isAllowedImageHostname('flow.martes.app')).toBe(true);
    expect(isAllowedImageHostname('lh3.googleusercontent.com')).toBe(true);
    expect(isAllowedImageHostname('res.cloudinary.com')).toBe(true);
    expect(isAllowedImageHostname('i.imgur.com')).toBe(true);
    expect(isAllowedImageHostname('cdn.shopify.com')).toBe(true);
  });

  it('rechaza hosts que terminan en el sufijo sin ser subdominio (notsupabase.co)', () => {
    expect(isAllowedImageHostname('notsupabase.co')).toBe(false);
    expect(isAllowedImageHostname('fakesupabase.co')).toBe(false);
    expect(isAllowedImageHostname('unsplash.com')).toBe(false);
  });

  it('es case-insensitive en el hostname', () => {
    expect(isAllowedImageHostname('IMAGES.Unsplash.COM')).toBe(true);
  });

  it('isAllowedImageUrl exige protocolo https', () => {
    expect(isAllowedImageUrl('https://images.unsplash.com/foto.jpg')).toBe(true);
    expect(isAllowedImageUrl('http://xyz.supabase.co/a.png')).toBe(false);
    expect(isAllowedImageUrl('ftp://images.unsplash.com/foto.jpg')).toBe(false);
    expect(isAllowedImageUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedImageUrl('no-es-una-url')).toBe(false);
  });

  it('isAllowedImageUrl rechaza URLs válidas con host no listado', () => {
    expect(isAllowedImageUrl('https://drive.google.com/uc?id=123')).toBe(false);
  });

  it('la whitelist no está vacía y solo contiene sufijos en minúsculas', () => {
    expect(ALLOWED_IMAGE_HOST_SUFFIXES.length).toBeGreaterThan(0);
    for (const suffix of ALLOWED_IMAGE_HOST_SUFFIXES) {
      expect(suffix).toBe(suffix.toLowerCase());
      expect(suffix.startsWith('.')).toBe(false);
    }
  });

  // ======================================================================
  // Cross-check contra el matcher REAL de Next.js (review Devin, P0 #63):
  // toda URL que isAllowedImageUrl acepta DEBE pasar hasRemoteMatch con los
  // remotePatterns generados por next.config.ts. Si estas dos fuentes
  // divergen, next/image lanzaría en render y tumbaría el storefront.
  // ======================================================================
  const REMOTE_PATTERNS = ALLOWED_IMAGE_HOST_SUFFIXES.flatMap((hostname) => [
    { protocol: 'https' as const, hostname },
    { protocol: 'https' as const, hostname: `*.${hostname}` },
  ]);

  function nextAccepts(url: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { hasRemoteMatch } = require('next/dist/shared/lib/match-remote-pattern.js') as {
      hasRemoteMatch: (domains: string[], patterns: Array<{ protocol: string; hostname: string }>, url: URL) => boolean;
    };
    return hasRemoteMatch([], REMOTE_PATTERNS, new URL(url));
  }

  it('toda URL aceptada por la whitelist es aceptada por los remotePatterns de Next (anti-crash)', () => {
    const acceptedSamples = [
      'https://images.unsplash.com/foto.jpg',
      'https://supabase.co/raiz.png', // dominio pelado
      'https://xyz.supabase.co/a.png',
      'https://a.b.supabase.co/anidado.png', // subdominio multinivel
      'https://bucket.r2.cloudflarestorage.com/x.jpg',
      'https://app.vercel.app/img.webp',
      'https://IMAGES.UNSPLASH.COM/CASE.PNG',
    ];
    for (const url of acceptedSamples) {
      expect(isAllowedImageUrl(url), `whitelist debe aceptar ${url}`).toBe(true);
      expect(nextAccepts(url), `next/image NO debe lanzar con ${url}`).toBe(true);
    }
  });

  it('ninguna URL rechazada por la whitelist llega a next/image (defensa en profundidad)', () => {
    const rejectedSamples = [
      'http://xyz.supabase.co/a.png', // http: next lo rechazaría (protocol https)
      'https://supabase.co.evil.com/a.png', // sufijo como subdominio de atacante
      'https://evil.com/uc?id=123',
      'https://evil-images.unsplash.com.evil.com/a.png',
    ];
    for (const url of rejectedSamples) {
      expect(isAllowedImageUrl(url), `whitelist debe rechazar ${url}`).toBe(false);
    }
  });
});

describe('normalizeProductImageUrl', () => {
  it('convierte enlaces de compartir de Google Drive (/file/d/) a stream directo en googleusercontent', () => {
    const driveUrl = 'https://drive.google.com/file/d/1B2C3D4E5F6G7H8I9J/view?usp=sharing';
    const normalized = normalizeProductImageUrl(driveUrl);
    expect(normalized).toBe('https://lh3.googleusercontent.com/d/1B2C3D4E5F6G7H8I9J');
    expect(isAllowedImageUrl(normalized)).toBe(true);
  });

  it('convierte enlaces open?id= de Google Drive a stream directo', () => {
    const driveUrl = 'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp';
    const normalized = normalizeProductImageUrl(driveUrl);
    expect(normalized).toBe('https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOp');
    expect(isAllowedImageUrl(normalized)).toBe(true);
  });

  it('preserva intactas URLs directas de otros hosts (Unsplash, R2, Cloudinary)', () => {
    const unsplash = 'https://images.unsplash.com/photo-12345?w=600';
    expect(normalizeProductImageUrl(unsplash)).toBe(unsplash);

    const r2 = 'https://pub-abc123.r2.dev/foto.webp';
    expect(normalizeProductImageUrl(r2)).toBe(r2);
  });

  it('maneja strings vacíos sin romper', () => {
    expect(normalizeProductImageUrl('')).toBe('');
    expect(normalizeProductImageUrl('   ')).toBe('');
  });
});

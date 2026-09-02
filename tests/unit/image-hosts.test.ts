import { describe, it, expect } from 'vitest';
import {
  ALLOWED_IMAGE_HOST_SUFFIXES,
  isAllowedImageHostname,
  isAllowedImageUrl,
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

  it('rechaza hosts ajenos (caso real: Google Drive, Imgur)', () => {
    expect(isAllowedImageHostname('drive.google.com')).toBe(false);
    expect(isAllowedImageHostname('i.imgur.com')).toBe(false);
    expect(isAllowedImageHostname('evil.com')).toBe(false);
  });

  it('rechaza hosts que terminan en el sufijo sin ser subdominio (notsupabase.co)', () => {
    expect(isAllowedImageHostname('notsupabase.co')).toBe(false);
    expect(isAllowedImageHostname('fakesupabase.co')).toBe(false);
    expect(isAllowedImageHostname('unsplash.com')).toBe(false);
  });

  it('es case-insensitive en el hostname', () => {
    expect(isAllowedImageHostname('IMAGES.Unsplash.COM')).toBe(true);
  });

  it('isAllowedImageUrl exige protocolo http/https', () => {
    expect(isAllowedImageUrl('https://images.unsplash.com/foto.jpg')).toBe(true);
    expect(isAllowedImageUrl('http://xyz.supabase.co/a.png')).toBe(true);
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
});

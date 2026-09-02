import { describe, it, expect } from 'vitest';
import {
  applyDriveNormalizationRegex,
  DRIVE_FILE_PATH_PATTERN,
  DRIVE_QUERY_ID_PATTERN,
} from '@/migrations/20260902_backfill_normalize_drive_image_urls';

describe('20260902_backfill_normalize_drive_image_urls migration patterns', () => {
  it('normaliza URLs legítimas de Google Drive /file/d/<id>', () => {
    const urls = [
      'https://drive.google.com/file/d/1B2C3D4E5F6G7H8I9J/view?usp=sharing',
      'http://drive.google.com/file/d/1B2C3D4E5F6G7H8I9J',
      '  https://drive.google.com/file/d/1B2C3D4E5F6G7H8I9J/view  ',
    ];
    for (const url of urls) {
      const normalized = applyDriveNormalizationRegex(url);
      expect(normalized).toBe('https://lh3.googleusercontent.com/d/1B2C3D4E5F6G7H8I9J');
    }
  });

  it('normaliza URLs legítimas de Google Drive open?id=<id> y uc?id=<id>', () => {
    const samples = [
      {
        url: 'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp',
        expected: 'https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOp',
      },
      {
        url: 'https://drive.google.com/uc?id=1AbCdEfGhIjKlMnOp&export=download',
        expected: 'https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOp',
      },
      {
        url: 'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOp',
        expected: 'https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOp',
      },
    ];
    for (const { url, expected } of samples) {
      expect(applyDriveNormalizationRegex(url)).toBe(expected);
    }
  });

  it('IGNORA estrictamente URLs que solo incrustan el texto drive.google.com (proxies, CDNs, atacantes)', () => {
    const nonDriveUrls = [
      'https://proxy.example/path/drive.google.com/file/d/ABC',
      'https://cdn.example.com/drive.google.com/file/d/ABC',
      'https://drive.google.com.attacker.com/file/d/ABC',
      'https://notdrive.google.com/file/d/ABC',
      'https://images.unsplash.com/photo-12345?ref=drive.google.com/file/d/ABC',
      'https://cdn.example.com/assets?url=https://drive.google.com/file/d/ABC',
      'https://example.com/drive.google.com/open?id=123',
    ];
    for (const url of nonDriveUrls) {
      expect(
        applyDriveNormalizationRegex(url),
        `La URL ${url} NO debe ser modificada por la migración`
      ).toBeNull();
    }
  });

  it('valida que los patrones POSIX comiencen anclados al inicio de línea (^)', () => {
    expect(DRIVE_FILE_PATH_PATTERN.startsWith('^\\s*https?://drive\\.google\\.com/')).toBe(true);
    expect(DRIVE_QUERY_ID_PATTERN.startsWith('^\\s*https?://drive\\.google\\.com/')).toBe(true);
  });
});

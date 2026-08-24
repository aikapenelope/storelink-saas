import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyCronSecret } from '../../src/lib/cron-secret';

/**
 * Contrato del helper timing-safe compartido por jobs.access.run (payload
 * REST /api/payload-jobs/run) y POST /api/admin/cleanup-jobs (plan v2 R2).
 */

const ENV_KEYS = ['CRON_SECRET'] as const;
const envBackup = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (envBackup[key] === undefined) delete process.env[key];
    else process.env[key] = envBackup[key];
  }
  vi.resetModules();
});

describe('verifyCronSecret', () => {
  it('acepta el secreto correcto', () => {
    process.env.CRON_SECRET = 'secreto-del-runner';
    expect(verifyCronSecret('secreto-del-runner')).toBe(true);
  });

  it('rechaza un secreto incorrecto', () => {
    process.env.CRON_SECRET = 'secreto-del-runner';
    expect(verifyCronSecret('otro-secreto')).toBe(false);
  });

  it('rechaza si CRON_SECRET no está configurado (fail-closed)', () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronSecret('lo-que-sea')).toBe(false);
  });

  it('rechaza header ausente o vacío', () => {
    process.env.CRON_SECRET = 'secreto-del-runner';
    expect(verifyCronSecret(null)).toBe(false);
    expect(verifyCronSecret(undefined)).toBe(false);
    expect(verifyCronSecret('')).toBe(false);
  });

  it('rechaza longitudes distintas sin lanzar (requisito de timingSafeEqual)', () => {
    process.env.CRON_SECRET = 'corto';
    expect(verifyCronSecret('un-intento-mucho-mas-largo-que-el-secreto')).toBe(false);
  });
});

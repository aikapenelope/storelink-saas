import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 120000,
    include: ['tests/**/*.test.ts'],
    // Serializa la ejecución de ARCHIVOS de test (auditoría 2026-09-05,
    // sprint 3): los archivos de integración comparten TEST_DATABASE_URI y
    // cada uno corre pushDevSchema (push:true) — en paralelo dos workers
    // crean el mismo enum (ej. enum_tenants_theme) y el segundo muere con
    // pg_type 23505 "already exists", tumbando la init de todo el archivo.
    // En serie la suite es determinista: 151 passed / 4 skipped / 0 failed.
    fileParallelism: false,
    // Las pruebas de integración requieren Postgres de prueba; sin la variable
    // solo corren las unitarias (ver tests/int/*.skipIf en su lugar).
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
      '@payload-config': path.resolve(dirname, './tests/payload.config.ts'),
    },
  },
});
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
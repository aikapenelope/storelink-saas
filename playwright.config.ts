import { defineConfig, devices } from '@playwright/test';

/**
 * Config de Playwright — patrón oficial confirmado contra
 * templates/ecommerce/playwright.config.ts del repo payloadcms/payload
 * (testDir './tests/e2e', webServer levantando `pnpm dev`, un solo proyecto
 * chromium). Complementa la suite de Vitest (tests/int/*.test.ts, Local API)
 * con pruebas de navegador real sobre el storefront y el admin.
 *
 * Requiere un entorno local con DATABASE_URI/POSTGRES_URL apuntando a una BD
 * (real o de prueba) con las migraciones aplicadas — no corre contra una BD
 * efímera como tests/payload.config.ts. Ver tests/helpers/seed.ts.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // No dejar test.only olvidado en un PR.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60000,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

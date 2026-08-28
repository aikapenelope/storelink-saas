import { test, expect } from '@playwright/test';
import { E2E_ADMIN, cleanupE2EFixtures, seedE2EFixtures } from '../helpers/seed';

/**
 * Smoke test del panel admin — cierra el punto (c) del incidente de
 * referencia (28-ago-2026 schema drift): un login + carga del dashboard que
 * consulte una columna inexistente responde 500 antes de que Payload
 * termine de renderizar. Este test detecta esa clase de fallo end-to-end,
 * a través del navegador real, complementando el test de paridad de
 * migraciones (tests/int/migration-parity.test.ts, que lo detecta a nivel
 * de Local API/SQL).
 *
 * Requiere `pnpm dev` con DATABASE_URI/POSTGRES_URL apuntando a una BD con
 * las migraciones al día (ver playwright.config.ts webServer).
 */
test.describe('Panel admin — login y dashboard', () => {
  let tenantSlug: string;

  test.beforeAll(async () => {
    const fixtures = await seedE2EFixtures();
    tenantSlug = fixtures.tenantSlug;
  });

  test.afterAll(async () => {
    await cleanupE2EFixtures(tenantSlug);
  });

  test('un super-admin puede iniciar sesión y ver el banner de tienda activa', async ({ page }) => {
    await page.goto('/admin/login');

    await page.locator('input[name="email"]').fill(E2E_ADMIN.email);
    await page.locator('input[name="password"]').fill(E2E_ADMIN.password);
    await page.locator('button[type="submit"]').click();

    // Redirige al dashboard del admin — si alguna colección referencia una
    // columna inexistente (schema drift), Payload responde 500 aquí.
    await expect(page).toHaveURL(/\/admin(\/collections\/tenants)?\/?$/, { timeout: 15000 });

    // StoreUrlBanner (src/components/admin/StoreUrlBanner.tsx): confirma que
    // el dashboard resolvió el tenant del super-admin sin error de columna.
    await expect(page.getByText('Tienda Activa:').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: /Abrir Tienda/i })).toBeVisible();
  });

  test('la vista de Analytics carga sin error 500', async ({ page }) => {
    await page.goto('/admin/login');
    await page.locator('input[name="email"]').fill(E2E_ADMIN.email);
    await page.locator('input[name="password"]').fill(E2E_ADMIN.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin/, { timeout: 15000 });

    const response = await page.goto('/admin/analytics');
    expect(response?.ok(), 'GET /admin/analytics debe responder 200 (sin columna faltante)').toBeTruthy();
  });
});

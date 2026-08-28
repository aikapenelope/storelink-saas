import { test, expect } from '@playwright/test';
import { THEME_METAS } from '../../src/data/theme-presets';
import {
  E2E_PRODUCT_TITLE,
  cleanupE2EFixtures,
  seedE2EFixtures,
  setE2ETenantTheme,
} from '../helpers/seed';

/**
 * Smoke test de storefront por las 9 plantillas de tema — cierra el punto
 * (a) del incidente de referencia (28-ago-2026 schema drift): un tenant
 * completo debe renderizar 200 sin errores para TODAS las plantillas, no
 * solo la que se usó para probar manualmente en su momento.
 *
 * Requiere `pnpm dev` con DATABASE_URI/POSTGRES_URL apuntando a una BD con
 * las migraciones al día (ver playwright.config.ts webServer).
 */
test.describe('Storefront — smoke por plantilla de tema', () => {
  let tenantId: number;
  let tenantSlug: string;

  test.beforeAll(async () => {
    const fixtures = await seedE2EFixtures();
    tenantId = fixtures.tenantId;
    tenantSlug = fixtures.tenantSlug;
  });

  test.afterAll(async () => {
    await cleanupE2EFixtures(tenantSlug);
  });

  for (const theme of THEME_METAS) {
    test(`renderiza sin error con el theme "${theme.id}" (${theme.name})`, async ({ page }) => {
      await setE2ETenantTheme(tenantId, theme.id);

      const response = await page.goto(`/${tenantSlug}`);
      expect(response?.ok(), `GET /${tenantSlug} con theme=${theme.id} debe responder 200`).toBeTruthy();

      // El catálogo debe mostrar el producto sembrado sin importar la
      // plantilla visual activa — las 9 plantillas comparten los mismos
      // datos de catálogo, solo cambia la presentación.
      await expect(page.getByText(E2E_PRODUCT_TITLE).first()).toBeVisible({ timeout: 15000 });
    });
  }
});

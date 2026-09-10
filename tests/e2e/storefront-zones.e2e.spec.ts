import { test, expect } from '@playwright/test';
import { E2E_PRODUCT_TITLE, cleanupE2EFixtures, seedE2EFixtures } from '../helpers/seed';

/**
 * PR 3.4 (plan sprints 2026-09-09): fixture de zonas de delivery + spec de
 * render. Este es el HUECO que dejó pasar el TDZ del cart-drawer (regresión
 * #101, corregida en PR 1.2): ningún test e2e montaba el drawer con zonas —
 * con deliveryConfig.zones.length >= 1 el storefront reventaba con
 * ReferenceError en SSR (tenant caído) y CI seguía verde porque el seed no
 * sembraba zonas.
 *
 * Ahora: el fixture siembra 2 zonas y la spec abre el drawer (con el carrito
 * poblado para que el flujo de checkout esté disponible) y verifica que el
 * selector de municipios está visible con las zonas sembradas — el render
 * que antes reventaba.
 */

const ZONES = [
  { name: 'Zona E2E Norte', priceDelivery: 3 },
  { name: 'Zona E2E Sur', priceDelivery: 4.5 },
];

test.describe('Storefront — drawer de carrito con zonas de delivery (regresión #101)', () => {
  let tenantSlug: string;

  test.beforeAll(async () => {
    const fixtures = await seedE2EFixtures({ zones: ZONES });
    tenantSlug = fixtures.tenantSlug;
  });

  test.afterAll(async () => {
    await cleanupE2EFixtures(tenantSlug);
  });

  test('el storefront renderiza 200 con zonas sembradas (antes: ReferenceError TDZ en SSR)', async ({ page }) => {
    const response = await page.goto(`/${tenantSlug}`);
    expect(
      response?.ok(),
      `GET /${tenantSlug} con deliveryConfig.zones debe responder 200 — el TDZ de la regresión #101 reventaba exactamente aquí`
    ).toBeTruthy();

    await expect(page.getByText(E2E_PRODUCT_TITLE).first()).toBeVisible({ timeout: 15000 });
  });

  test('el drawer de carrito muestra el selector de municipios con las zonas sembradas', async ({ page }) => {
    await page.goto(`/${tenantSlug}`);
    await expect(page.getByText(E2E_PRODUCT_TITLE).first()).toBeVisible({ timeout: 15000 });

    // Añadir el producto al carrito y abrir el drawer (el flujo del TDZ).
    await page.getByText(E2E_PRODUCT_TITLE).first().click();
    // El botón de añadir del modal/producto usa texto estándar del storefront.
    await page
      .locator('button', { hasText: /agregar|añadir|comprar/i })
      .first()
      .click();

    // Abrir el drawer de carrito.
    await page
      .locator('button', { hasText: /carrito|cart/i })
      .first()
      .click();

    // La PRUEBA del hueco: con zonas, el selector de municipio del formulario
    // de delivery debe existir y contener las zonas sembradas. Antes del fix
    // (PR 1.2) el drawer reventaba con ReferenceError antes de renderizar
    // cualquier cosa.
    const municipioSelect = page.locator('select').filter({
      has: page.locator('option', { hasText: 'Zona E2E Norte' }),
    });
    await expect(municipioSelect).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('option', { hasText: 'Zona E2E Sur' }).first()
    ).toBeAttached();
  });
});

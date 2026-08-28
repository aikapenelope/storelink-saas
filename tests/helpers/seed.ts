/**
 * Helpers de seed para Playwright (tests/e2e/*). Hablan por HTTP con
 * `src/app/api/e2e/seed/route.ts`, que corre DENTRO del proceso de
 * `pnpm dev` (ver ese archivo para el por qué: cargar src/payload.config.ts
 * desde un proceso externo de Node/tsx choca con la fricción ESM/CJS ya
 * documentada en AGENTS.md para `pnpm migrate:create`).
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const E2E_SEED_SECRET = process.env.E2E_SEED_SECRET || 'e2e-local-dev-secret';

export const E2E_ADMIN = {
  email: 'e2e-admin@storelink.test',
  password: 'e2e-test-password',
};

export const E2E_PRODUCT_SKU = 'E2E-PRODUCT';
export const E2E_PRODUCT_TITLE = 'Producto E2E';

async function callSeedEndpoint(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/e2e/seed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-secret': E2E_SEED_SECRET,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Seed endpoint respondió ${res.status} para action="${body.action}": ${text}. ` +
        'Verifica que E2E_SEED_SECRET coincida en .env y que `pnpm dev` NO esté corriendo con NODE_ENV=production.'
    );
  }
  return (await res.json()) as Record<string, unknown>;
}

export async function seedE2EFixtures(): Promise<{ tenantId: number; tenantSlug: string }> {
  const tenantSlug = `e2e-${Date.now()}`;
  const result = await callSeedEndpoint({
    action: 'seed',
    email: E2E_ADMIN.email,
    password: E2E_ADMIN.password,
    tenantSlug,
    productSku: E2E_PRODUCT_SKU,
  });
  return { tenantId: result.tenantId as number, tenantSlug: result.tenantSlug as string };
}

export async function cleanupE2EFixtures(tenantSlug?: string): Promise<void> {
  await callSeedEndpoint({
    action: 'cleanup',
    email: E2E_ADMIN.email,
    tenantSlug,
    productSku: E2E_PRODUCT_SKU,
  });
}

export async function setE2ETenantTheme(tenantId: number, theme: string): Promise<void> {
  await callSeedEndpoint({ action: 'setTheme', tenantId, theme });
}

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getPayload } from 'payload';
import config from '@payload-config';

/**
 * Endpoint de seed/cleanup EXCLUSIVO para las pruebas E2E de Playwright
 * (tests/e2e/*, ver tests/helpers/seed.ts) y para el pentest cross-tenant
 * (scripts/pentest-cross-tenant.mjs). Corre dentro del propio proceso de
 * `pnpm dev` — getPayload + Local API funcionan aquí porque es el mismo
 * runtime real de la app (igual que cualquier otra ruta de src/app/api/).
 *
 * Se resolvió así (en vez de que Playwright importe src/payload.config.ts
 * directamente) porque intentar cargar esa config desde un proceso externo
 * de Node/tsx choca con la misma fricción ESM/CJS ya documentada en
 * AGENTS.md para `pnpm migrate:create` (import.meta.url + top-level await
 * de richtext-lexical). Patrón equivalente al oficial de Payload:
 * templates/ecommerce/src/endpoints/seed del repo payloadcms/payload expone
 * un endpoint de seed vía Local API para que las pruebas E2E siembren datos
 * a través de la app en ejecución, no importando la config a mano.
 *
 * Guardias (endurecidas tras el review Devin del PR #85):
 *
 * 1. ALLOWLIST de entorno FAIL-CLOSED: la ÚNICA excepción en la nube es
 *    VERCEL_ENV === 'preview'. Cualquier otro valor de VERCEL_ENV (futuro o
 *    mal configurado) con runtime de producción queda bloqueado; `pnpm dev`
 *    local (NODE_ENV=development) pasa.
 * 2. Secreto timing-safe por header `x-e2e-secret` (mismo patrón que
 *    verifyCronSecret en lib/cron-secret.ts).
 * 3. NAMESPACE E2E obligatorio: el preview comparte la BD de producción, así
 *    que TODO lo que este endpoint crea o borra queda acotado a fixtures con
 *    prefijos reservados (slugs `e2e-*`, emails `*@storelink.test`, SKUs
 *    `E2E-*`). Un secreto filtrado NUNCA puede tocar tenants, usuarios,
 *    productos u órdenes reales (don-luigi/aurita), ni fabricar un login de
 *    super-admin: el usuario sembrado es tenant-admin de SU tenant fixture.
 * 4. Limpieza parcial ante fallo: si un seed falla a mitad, los pedazos ya
 *    creados se eliminan antes de responder el error (sin fixtures huérfanos).
 */

/** Error de validación del namespace E2E → responde 400 (no 500). */
class E2eNamespaceError extends Error {}

const E2E_SLUG_RE = /^e2e-[a-z0-9-]{1,60}$/;
const E2E_EMAIL_SUFFIX = '@storelink.test';
const E2E_SKU_PREFIX = 'E2E-';

function e2eSlug(value: string | undefined | null, fallback: string): string {
  const slug = value || fallback;
  if (!E2E_SLUG_RE.test(slug)) {
    throw new E2eNamespaceError(
      `Slug fuera del namespace E2E (debe casar con ${E2E_SLUG_RE.source}): "${slug}"`
    );
  }
  return slug;
}

function e2eEmail(value: string | undefined | null, fallback: string): string {
  const email = value || fallback;
  if (!email.endsWith(E2E_EMAIL_SUFFIX)) {
    throw new E2eNamespaceError(
      `Email fuera del namespace E2E (debe terminar en ${E2E_EMAIL_SUFFIX}): "${email}"`
    );
  }
  return email;
}

function e2eSku(value: string | undefined | null, fallback: string): string {
  const sku = value || fallback;
  if (!sku.startsWith(E2E_SKU_PREFIX)) {
    throw new E2eNamespaceError(
      `SKU fuera del namespace E2E (debe empezar por "${E2E_SKU_PREFIX}"): "${sku}"`
    );
  }
  return sku;
}

function verifyE2ESecret(provided: string | null): boolean {
  if (!provided) return false;
  const expected = process.env.E2E_SEED_SECRET || '';
  if (!expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** true si el entorno debe tener el seed MUERTO (404), sin importar el secreto. */
function isSeedForbiddenEnvironment(): boolean {
  // Allowlist fail-closed (review Devin #85): solo 'preview' está exento;
  // 'production' y cualquier valor inesperado con runtime productivo → 404.
  if (process.env.VERCEL_ENV === 'preview') return false;
  return process.env.NODE_ENV === 'production';
}

export async function POST(request: NextRequest) {
  if (isSeedForbiddenEnvironment()) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }
  if (!verifyE2ESecret(request.headers.get('x-e2e-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await getPayload({ config });
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    email?: string;
    password?: string;
    tenantSlug?: string;
    tenantId?: number;
    theme?: string;
    productSku?: string;
    // PR 3.4 (plan sprints 2026-09-09): zonas de delivery del fixture
    // (regresión #101 — ningún test montaba el drawer con zonas).
    zones?: Array<{ name?: string; priceDelivery?: number }>;
    // Escenario cross-tenant (pentest, sprint 2)
    tenantASlug?: string;
    tenantBSlug?: string;
    productBSku?: string;
  };

  try {
    if (body.action === 'seed') {
      const email = e2eEmail(body.email, 'e2e-admin@storelink.test');
      const password = body.password || 'e2e-test-password';
      const tenantSlug = e2eSlug(body.tenantSlug, `e2e-${Date.now()}`);
      const productSku = e2eSku(body.productSku, 'E2E-PRODUCT');

      // Cleanup previo acotado al namespace (belt-and-braces: el WHERE exacto
      // + verificación JS del prefijo antes de cada delete por id).
      await deleteE2eUsersByEmail(payload, email);
      const previousTenants = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: tenantSlug } },
        limit: 5,
        depth: 0,
        overrideAccess: true,
      });
      for (const doc of previousTenants.docs) {
        if (E2E_SLUG_RE.test(doc.slug)) {
          await deleteTenantFixture(payload, doc.id);
        }
      }

      // El tenant va PRIMERO: el usuario sembrado es tenant-admin de SU fixture
      // (review Devin #85: un secreto filtrado no puede fabricar un
      // super-admin logueable contra la BD compartida del preview).
      // PR 3.4 (plan sprints 2026-09-09): deliveryConfig.zones OPCIONAL —
      // el fixture de zonas que dejó pasar el TDZ del cart-drawer (regresión
      // #101, PR 1.2): ningún test montaba el drawer con zonas.
      const zonesInput = Array.isArray(body.zones)
        ? (body.zones as Array<{ name?: unknown; priceDelivery?: unknown }>)
            .filter((z) => typeof z?.name === 'string' && z.name.length > 0)
            .slice(0, 10)
            .map((z) => ({
              name: String(z.name),
              // Fix Devin #115: un valor negativo pasaría el typeof pero Payload
              // lo rechaza con min: 0 → el seed aborta con 500 sin crear fixtures.
              priceDelivery:
                typeof z.priceDelivery === 'number' &&
                Number.isFinite(z.priceDelivery) &&
                z.priceDelivery >= 0
                  ? z.priceDelivery
                  : 0,
            }))
        : undefined;

      const tenant = await payload.create({
        collection: 'tenants',
        overrideAccess: true,
        data: {
          name: 'Tienda E2E',
          slug: tenantSlug,
          whatsappPhone: '584120000000',
          theme: 'basic-banner',
          ...(zonesInput && zonesInput.length > 0
            ? { deliveryConfig: { fixedPrice: 2, zones: zonesInput } }
            : {}),
        } as never,
      });

      let user: { id: number | string } | null = null;
      let product: { id: number | string } | null = null;
      try {
        user = await payload.create({
          collection: 'users',
          overrideAccess: true,
          data: {
            email,
            password,
            role: 'tenant-admin',
            tenants: [{ tenant: tenant.id }],
          } as never,
        });

        product = await payload.create({
          collection: 'products',
          overrideAccess: true,
          data: {
            tenant: tenant.id,
            title: 'Producto E2E',
            price: 9.99,
            sku: productSku,
            trackStock: false,
            stockStatus: 'in_stock',
          } as never,
        });
      } catch (err) {
        // Limpieza parcial (review Devin #85): sin fixtures huérfanos.
        await cleanupFailedSeed(payload, { tenantIds: [tenant.id], userId: user?.id ?? null });
        throw err;
      }

      return NextResponse.json({
        tenantId: tenant.id,
        tenantSlug,
        userId: user.id,
        productId: product.id,
      });
    }

    if (body.action === 'setTheme') {
      if (!body.tenantId || !body.theme) {
        return NextResponse.json({ error: 'tenantId y theme son requeridos' }, { status: 400 });
      }
      // El update de tema solo toca tenants del namespace E2E.
      const tenantDocs = await payload.find({
        collection: 'tenants',
        where: { id: { equals: body.tenantId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      const target = tenantDocs.docs[0];
      if (!target || !E2E_SLUG_RE.test(target.slug)) {
        return NextResponse.json(
          { error: 'tenantId no pertenece al namespace E2E' },
          { status: 400 }
        );
      }
      await payload.update({
        collection: 'tenants',
        id: body.tenantId,
        overrideAccess: true,
        data: { theme: body.theme } as never,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'cleanup') {
      const email = e2eEmail(body.email, 'e2e-admin@storelink.test');
      const productSku = e2eSku(body.productSku, 'E2E-PRODUCT');
      const tenantSlug = body.tenantSlug ? e2eSlug(body.tenantSlug, '') : null;

      await deleteE2eProductsBySku(payload, productSku);
      if (tenantSlug) {
        await deleteE2eTenantsBySlug(payload, tenantSlug);
      }
      await deleteE2eUsersByEmail(payload, email);
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'seedCrossTenant') {
      // Escenario del pentest autenticado (auditoría 2026-09-05, hallazgo a):
      // tenant A + tenant B + un usuario tenant-admin asignado SOLO a A, un
      // producto en B y una orden en B. Todo dentro del namespace E2E.
      const suffix = Date.now();
      const email = e2eEmail(body.email, 'e2e-pentest@storelink.test');
      const password = body.password || 'e2e-pentest-password';
      const tenantASlug = e2eSlug(body.tenantASlug, `e2e-pentest-a-${suffix}`);
      const tenantBSlug = e2eSlug(body.tenantBSlug, `e2e-pentest-b-${suffix}`);
      const productBSku = e2eSku(body.productBSku, `E2E-PENTEST-B-${suffix}`);

      await deleteE2eUsersByEmail(payload, email);

      const tenantA = await payload.create({
        collection: 'tenants',
        overrideAccess: true,
        data: {
          name: 'Pentest Tienda A',
          slug: tenantASlug,
          whatsappPhone: '584120000001',
          theme: 'basic-banner',
        } as never,
      });

      let tenantB: { id: number | string } | null = null;
      let user: { id: number | string } | null = null;
      let productB: { id: number | string; sku?: string; title?: string } | null = null;
      let orderBId: number | string | null = null;
      let orderBNumber = `E2EP-${suffix}`;
      try {
        tenantB = await payload.create({
          collection: 'tenants',
          overrideAccess: true,
          data: {
            name: 'Pentest Tienda B',
            slug: tenantBSlug,
            whatsappPhone: '584120000002',
            theme: 'basic-banner',
          } as never,
        });

        // tenant-admin con SOLO el tenant A en su array (el array `tenants` de
        // users lo manipula super-admin — aquí es seed server-side de confianza).
        user = await payload.create({
          collection: 'users',
          overrideAccess: true,
          data: {
            email,
            password,
            role: 'tenant-admin',
            tenants: [{ tenant: tenantA.id }],
          } as never,
        });

        productB = await payload.create({
          collection: 'products',
          overrideAccess: true,
          data: {
            tenant: tenantB.id,
            title: 'Producto B Pentest',
            price: 5.5,
            sku: productBSku,
            trackStock: false,
            stockStatus: 'in_stock',
          } as never,
        });

        // Orden real en B (con skipInventoryHook: la deducción de inventario no
        // corre y el seed no muta stock — mismo context flag que usa el job
        // oficial order-created).
        try {
          const orderB = await payload.create({
            collection: 'orders',
            overrideAccess: true,
            context: { skipInventoryHook: true },
            data: {
              orderNumber: orderBNumber,
              tenant: tenantB.id,
              status: 'pending',
              customer: {
                name: 'Cliente Pentest B',
                phone: '+584120000002',
                email: 'cliente-b@test.local',
              },
              items: [
                {
                  sku: productB.sku,
                  title: productB.title ?? 'Producto B Pentest',
                  price: 5.5,
                  quantity: 1,
                  subtotal: 5.5,
                },
              ],
              totalAmount: 5.5,
            } as never,
          });
          orderBId = orderB.id;
          orderBNumber = (orderB as { orderNumber?: string }).orderNumber || orderBNumber;
        } catch (orderErr) {
          // Si el schema de Orders exige algo más, el pentest degrada a SKIP
          // para las pruebas de orden (no bloquea el resto de la matriz).
          console.warn('[e2e-seed] orden de B no creada (pentest la marcará SKIP):', orderErr);
          orderBId = null;
        }
      } catch (err) {
        // Limpieza parcial (review Devin #85): sin fixtures huérfanos.
        await cleanupFailedSeed(payload, {
          tenantIds: [tenantA.id, tenantB?.id ?? null],
          userId: user?.id ?? null,
          productIds: [productB?.id ?? null],
        });
        throw err;
      }

      return NextResponse.json({
        tenantAId: tenantA.id,
        tenantASlug,
        tenantBId: tenantB.id,
        tenantBSlug,
        productBId: productB.id,
        productBSku,
        orderBId,
        orderBNumber,
        email,
        password,
      });
    }

    if (body.action === 'cleanupCrossTenant') {
      const email = e2eEmail(body.email, 'e2e-pentest@storelink.test');
      const tenantASlug = body.tenantASlug ? e2eSlug(body.tenantASlug, '') : null;
      const tenantBSlug = body.tenantBSlug ? e2eSlug(body.tenantBSlug, '') : null;

      for (const slug of [tenantASlug, tenantBSlug]) {
        if (!slug) continue;
        await deleteE2eTenantsBySlug(payload, slug);
      }
      await deleteE2eUsersByEmail(payload, email);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 });
  } catch (err) {
    if (err instanceof E2eNamespaceError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno del seed E2E' },
      { status: 500 }
    );
  }
}

/**
 * Borra un tenant fixture y sus hijos (orders, products). El caller debe
 * haber verificado ya que el slug pertenece al namespace E2E (review Devin
 * #85: donde Payload no ofrece operador de prefijo, se filtra en memoria
 * antes del delete — nunca un delete por id de un tenant real).
 */
async function deleteTenantFixture(
  payload: Awaited<ReturnType<typeof getPayload>>,
  tenantId: number | string
): Promise<void> {
  for (const collection of ['orders', 'products'] as const) {
    await payload.delete({
      collection,
      where: { tenant: { equals: tenantId } },
      overrideAccess: true,
    });
  }
  await payload.delete({
    collection: 'tenants',
    id: tenantId,
    overrideAccess: true,
  });
}

/** Borra los tenants cuyo slug coincide Y pertenece al namespace E2E. */
async function deleteE2eTenantsBySlug(
  payload: Awaited<ReturnType<typeof getPayload>>,
  slug: string
): Promise<void> {
  const res = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 10,
    depth: 0,
    overrideAccess: true,
  });
  for (const doc of res.docs) {
    if (E2E_SLUG_RE.test(doc.slug)) {
      await deleteTenantFixture(payload, doc.id);
    }
  }
}

/** Borra productos por SKU exacto, solo si el SKU lleva prefijo E2E-. */
async function deleteE2eProductsBySku(
  payload: Awaited<ReturnType<typeof getPayload>>,
  sku: string
): Promise<void> {
  if (!sku.startsWith(E2E_SKU_PREFIX)) return;
  await payload.delete({
    collection: 'products',
    where: { sku: { equals: sku } },
    overrideAccess: true,
  });
}

/** Borra el usuario por email exacto, solo si el email es del dominio de test. */
async function deleteE2eUsersByEmail(
  payload: Awaited<ReturnType<typeof getPayload>>,
  email: string
): Promise<void> {
  if (!email.endsWith(E2E_EMAIL_SUFFIX)) return;
  await payload.delete({
    collection: 'users',
    where: { email: { equals: email } },
    overrideAccess: true,
  });
}

/** Limpieza parcial de un seed que falló a mitad (review Devin #85). */
async function cleanupFailedSeed(
  payload: Awaited<ReturnType<typeof getPayload>>,
  fixtures: {
    tenantIds: Array<number | string | null>;
    userId?: number | string | null;
    productIds?: Array<number | string | null>;
  }
): Promise<void> {
  for (const id of fixtures.productIds ?? []) {
    if (id == null) continue;
    await payload.delete({ collection: 'products', id, overrideAccess: true }).catch(() => {});
  }
  for (const id of fixtures.tenantIds) {
    if (id == null) continue;
    await deleteTenantFixture(payload, id).catch(() => {});
  }
  if (fixtures.userId != null) {
    await payload
      .delete({ collection: 'users', id: fixtures.userId, overrideAccess: true })
      .catch(() => {});
  }
}

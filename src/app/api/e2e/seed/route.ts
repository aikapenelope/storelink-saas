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
 * Guardia de entorno FAIL-CLOSED (sprint 2): el seed debe funcionar en
 * `pnpm dev` local y en PREVIEW de Vercel, y estar MUERTO en producción.
 * - NODE_ENV=production en TODOS los deploys de Vercel (incluye previews),
 *   así que el guard por NODE_ENV impedía E2E en preview — el hallazgo (a)
 *   de la auditoría 2026-09-05 no era ejecutable en la nube por esto.
 * - VERCEL_ENV distingue: 'production' (deploy real), 'preview' (preview).
 * - En local, NODE_ENV=production sin VERCEL_ENV es un `pnpm start` de
 *   build productivo: también bloqueado (fail-closed ante ambigüedad).
 * 2. Secreto timing-safe por header `x-e2e-secret` (mismo patrón que
 * verifyCronSecret en lib/cron-secret.ts) para que ni siquiera en
 * preview/desarrollo cualquiera pueda sembrar/borrar datos.
 */
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
  const isVercelProduction = process.env.VERCEL_ENV === 'production';
  const isLocalProductionBuild =
    process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV;
  return isVercelProduction || isLocalProductionBuild;
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
    // Escenario cross-tenant (pentest, sprint 2)
    tenantASlug?: string;
    tenantBSlug?: string;
    productBSku?: string;
  };

  try {
    if (body.action === 'seed') {
      const email = body.email || 'e2e-admin@storelink.test';
      const password = body.password || 'e2e-test-password';
      const tenantSlug = body.tenantSlug || `e2e-${Date.now()}`;
      const productSku = body.productSku || 'E2E-PRODUCT';

      await payload.delete({
        collection: 'users',
        where: { email: { equals: email } },
        overrideAccess: true,
      });
      await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: { email, password, role: 'super-admin' } as never,
      });

      const tenant = await payload.create({
        collection: 'tenants',
        overrideAccess: true,
        data: {
          name: 'Tienda E2E',
          slug: tenantSlug,
          whatsappPhone: '584120000000',
          theme: 'basic-banner',
        } as never,
      });

      await payload.create({
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

      return NextResponse.json({ tenantId: tenant.id, tenantSlug });
    }

    if (body.action === 'setTheme') {
      if (!body.tenantId || !body.theme) {
        return NextResponse.json({ error: 'tenantId y theme son requeridos' }, { status: 400 });
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
      const email = body.email || 'e2e-admin@storelink.test';
      const tenantSlug = body.tenantSlug;
      const productSku = body.productSku || 'E2E-PRODUCT';

      await payload.delete({
        collection: 'products',
        where: { sku: { equals: productSku } },
        overrideAccess: true,
      });
      if (tenantSlug) {
        await payload.delete({
          collection: 'tenants',
          where: { slug: { equals: tenantSlug } },
          overrideAccess: true,
        });
      }
      await payload.delete({
        collection: 'users',
        where: { email: { equals: email } },
        overrideAccess: true,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'seedCrossTenant') {
      // Escenario del pentest autenticado (auditoría 2026-09-05, hallazgo a):
      // tenant A + tenant B + un usuario tenant-admin asignado SOLO a A, un
      // producto en B y una orden en B. El script scripts/pentest-cross-
      // tenant.mjs inicia sesión como A e intenta leer/escribir recursos de B
      // por REST — todas las fronteras deben rechazarlo o filtrarlo.
      const suffix = Date.now();
      const email = body.email || 'e2e-pentest@storelink.test';
      const password = body.password || 'e2e-pentest-password';
      const tenantASlug = body.tenantASlug || `e2e-pentest-a-${suffix}`;
      const tenantBSlug = body.tenantBSlug || `e2e-pentest-b-${suffix}`;
      const productBSku = body.productBSku || `E2E-PENTEST-B-${suffix}`;

      await payload.delete({
        collection: 'users',
        where: { email: { equals: email } },
        overrideAccess: true,
      });

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

      const tenantB = await payload.create({
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
      await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: {
          email,
          password,
          role: 'tenant-admin',
          tenants: [{ tenant: tenantA.id }],
        } as never,
      });

      const productB = await payload.create({
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
      let orderBId: number | string | null = null;
      let orderBNumber = `E2EP-${suffix}`;
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
              { sku: productB.sku, title: productB.title, price: 5.5, quantity: 1, subtotal: 5.5 },
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
      const email = body.email || 'e2e-pentest@storelink.test';
      const tenantASlug = body.tenantASlug;
      const tenantBSlug = body.tenantBSlug;

      for (const slug of [tenantASlug, tenantBSlug]) {
        if (!slug) continue;
        const tenantsRes = await payload.find({
          collection: 'tenants',
          where: { slug: { equals: slug } },
          limit: 1,
          overrideAccess: true,
          depth: 0,
        });
        const tenant = tenantsRes.docs[0];
        if (!tenant) continue;
        // Hijos primero (orders/products de ambos tenants), luego el tenant.
        for (const collection of ['orders', 'products'] as const) {
          await payload.delete({
            collection,
            where: { tenant: { equals: tenant.id } },
            overrideAccess: true,
          });
        }
        await payload.delete({ collection: 'tenants', where: { id: { equals: tenant.id } }, overrideAccess: true });
      }

      await payload.delete({
        collection: 'users',
        where: { email: { equals: email } },
        overrideAccess: true,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno del seed E2E' },
      { status: 500 }
    );
  }
}

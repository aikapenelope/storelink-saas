import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getPayload } from 'payload';
import config from '@payload-config';

/**
 * Endpoint de seed/cleanup EXCLUSIVO para las pruebas E2E de Playwright
 * (tests/e2e/*, ver tests/helpers/seed.ts). Corre dentro del propio proceso
 * de `pnpm dev` — getPayload + Local API funcionan aquí porque es el mismo
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
 * Doble guardia:
 * 1. Bloqueo DURO si NODE_ENV === 'production' — nunca responde en un
 *    deploy real de Vercel, sin importar el secreto.
 * 2. Secreto timing-safe por header `x-e2e-secret` (mismo patrón que
 *    verifyCronSecret en lib/cron-secret.ts) para que ni siquiera en
 *    preview/desarrollo cualquiera pueda sembrar/borrar datos.
 */
function verifyE2ESecret(provided: string | null): boolean {
  if (!provided) return false;
  const expected = process.env.E2E_SEED_SECRET || '';
  if (!expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
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

    return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno del seed E2E' },
      { status: 500 }
    );
  }
}

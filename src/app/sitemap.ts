import type { MetadataRoute } from 'next';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { Tenant } from '@/payload-types';

/**
 * Auditoría 2026-09-04 (P1 SEO): el SaaS vive del tráfico orgánico de las
 * tiendas y no tenía sitemap.xml. Se emiten las rutas estáticas + la página
 * de cada tenant activo. Los productos no entran porque no existe ruta de
 * detalle por producto (solo catálogo por tenant) — cuando se agregue
 * /p/[slug], emitir aquí también.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://flow.martes.app';

// force-dynamic: el sitemap se genera a demanda (runtime), NUNCA en el build.
// `getPayload` en el build dispara el init de Payload y con él `prodMigrations`
// (payload.config.ts) usando el Transaction Pooler (6543): una migración DDL
// pendiente (RLS/índices) con guardia anti-pooler rompía el BUILD de Vercel
// (no solo el runtime). Al no prerenderizarse, el init (y las migraciones) solo
// corren en runtime, donde el flujo de emergencia (DDL por conexión directa +
// registro en payload_migrations) ya dejó la BD al día. Regenera cada request,
// lo cual es correcto para un sitemap multi-tenant que depende de datos vivos.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/templates`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/privacidad`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  // Sin BD configurada (build local/CI): no intentar conectar — el runtime de
  // producción (con DATABASE_URI) es el que regenera el sitemap con tenants.
  if (!process.env.DATABASE_URI && !process.env.POSTGRES_URL) {
    return staticRoutes;
  }

  try {
    const payload = await getPayload({ config });
    // Review Devin #73: paginar con hasNextPage — el limit fijo en 500 hacía
    // desaparecer del sitemap a las tiendas a partir del 501 sin error ni log.
    const PER_PAGE = 500;
    const tenantRoutes: Array<{
      url: string;
      changeFrequency: 'daily';
      priority: number;
      lastModified?: Date;
    }> = [];
    let page = 1;
    let hasNextPage = true;
    while (hasNextPage) {
      const tenants = await payload.find({
        collection: 'tenants',
        limit: PER_PAGE,
        page,
        depth: 0,
        sort: 'name',
      });
      for (const t of tenants.docs) {
        if (!(t as Tenant & { slug?: string }).slug) continue;
        tenantRoutes.push({
          url: `${SITE_URL}/${(t as Tenant & { slug: string }).slug}`,
          changeFrequency: 'daily',
          priority: 0.9,
          lastModified: t.updatedAt ? new Date(t.updatedAt) : undefined,
        });
      }
      hasNextPage = Boolean(tenants.hasNextPage);
      page += 1;
    }
    return [...staticRoutes, ...tenantRoutes];
  } catch {
    // Build local/CI sin BD: sitemap con rutas estáticas; en el runtime de
    // producción (con DATABASE_URI) se regenera con los tenants reales.
    return staticRoutes;
  }
}

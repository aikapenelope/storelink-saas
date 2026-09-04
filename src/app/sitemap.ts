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

// Regenera como máximo cada hora; mutaciones de tenants quedan acotadas a ese TTL.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/templates`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/privacidad`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  try {
    const payload = await getPayload({ config });
    const tenants = await payload.find({
      collection: 'tenants',
      limit: 500,
      depth: 0,
      sort: 'name',
    });
    return [
      ...staticRoutes,
      ...tenants.docs
        .filter((t: Tenant): t is Tenant & { slug: string } => Boolean(t.slug))
        .map((t) => ({
          url: `${SITE_URL}/${t.slug}`,
          changeFrequency: 'daily' as const,
          priority: 0.9,
          lastModified: t.updatedAt ? new Date(t.updatedAt) : undefined,
        })),
    ];
  } catch {
    // Build local/CI sin BD: sitemap con rutas estáticas; en el runtime de
    // producción (con DATABASE_URI) se regenera con los tenants reales.
    return staticRoutes;
  }
}

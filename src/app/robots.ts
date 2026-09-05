import type { MetadataRoute } from 'next';

// Auditoría 2026-09-04 (P1 SEO): el repo no tenía robots.txt — los crawlers
// asumían allow-all y podían rastrear /admin, /demo y toda la superficie de
// API. Los slugs 'robots.txt' y 'sitemap.xml' ya estaban reservados en
// constants.ts anticipando estos archivos.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://flow.martes.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', '/demo'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

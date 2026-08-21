import { NextRequest, NextResponse } from 'next/server';

/**
 * Audit fix: la resolución por subdominios (*.martes.app) fue ELIMINADA.
 * El modelo de URLs es exclusivamente por ruta: https://flow.martes.app/[slug]
 * (ver docs/GUIA_GESTION_FLOW.md). El matcher mantiene las rutas de tienda en
 * SSR dinámico y deja estáticos/API/admin fuera del middleware.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - /api (API routes)
     * - /admin (Payload admin dashboard)
     * - /_next (Next.js static assets and build files)
     * - /static (static files)
     * - favicon.ico, sitemap.xml, robots.txt, manifest.json
     * - all files with an extension (e.g. .svg, .png, .jpg, .css, .js)
     */
    '/((?!api|admin|_next|_static|_vercel|[\\w-]+\\.\\w+).*)',
  ],
};

export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

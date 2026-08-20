import { NextRequest, NextResponse } from 'next/server';

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

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';

  // Clean hostname from port if present (e.g. "donluigi.martes.app:3000" -> "donluigi.martes.app")
  const currentHost = hostname.replace(/:\d+$/, '').toLowerCase();

  // Root domains that should display the main Flow landing page
  const isRootDomain =
    currentHost === 'flow.martes.app' ||
    currentHost === 'martes.app' ||
    currentHost === 'www.martes.app' ||
    currentHost === 'localhost' ||
    currentHost === '127.0.0.1' ||
    currentHost.endsWith('.vercel.app');

  if (isRootDomain) {
    return NextResponse.next();
  }

  // Handle subdomain matching for *.martes.app (e.g. "donluigi.martes.app")
  if (currentHost.endsWith('.martes.app')) {
    const subdomain = currentHost.replace('.martes.app', '');

    // Skip special non-tenant subdomains
    if (subdomain && subdomain !== 'flow' && subdomain !== 'www' && subdomain !== 'admin' && subdomain !== 'api') {
      // Rewrite to /[tenant] route internally
      return NextResponse.rewrite(
        new URL(`/${subdomain}${url.pathname}${url.search}`, req.url)
      );
    }
  }

  return NextResponse.next();
}

import { withPayload } from '@payloadcms/next/withPayload';

/**
 * Security headers fase 1 (plan docs/PLAN_ROBUSTECIMIENTO_v2.md, R7/C6):
 * - XFO/nosniff/HSTS/Referrer-Policy/Permissions-Policy se aplican en firme.
 * - La CSP va en modo Report-Only: una CSP restrictiva con script-src sin
 *   nonces rompería el admin de Payload (scripts inline de Next). Fase 2
 *   (backlog): endurecer script-src con nonces cuando el stack lo permita.
 * - img-src: cubre los CDNs reales que los comerciantes usan en imageUrls
 *   de productos (Google Drive, Cloudinary, Pexels…) + blob:/data: para el
 *   editor de imágenes del admin. Sin estos dominios, al pasar la CSP a
 *   enforce en Fase 2 todas las imágenes de producto quedarían bloqueadas.
 * - connect-src incluye Upstash REST API (rate-limit/exchange-rate) y la
 *   propia URL del sitio (fetch de Server Actions y route handlers).
 */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy-Report-Only',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://code.iconify.design",
      "style-src 'self' 'unsafe-inline'",
      // img-src: Unsplash + R2/Supabase/Vercel (infraestructura propia) +
      // Google Drive (lh3.googleusercontent.com = thumbnails de Drive,
      // drive.google.com = enlaces directos) + Cloudinary + Pexels +
      // code.iconify.design (iconos inline del admin) +
      // blob:/data: para el editor de imágenes del admin.
      "img-src 'self' blob: data: https://images.unsplash.com https://*.r2.cloudflarestorage.com https://*.supabase.co https://*.vercel.app https://drive.google.com https://lh3.googleusercontent.com https://res.cloudinary.com https://images.pexels.com https://code.iconify.design",
      "font-src 'self' data:",
      // connect-src: el propio sitio + Upstash REST (rate-limit/exchange-rate)
      "connect-src 'self' https://*.upstash.io",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      'upgrade-insecure-requests',
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  headers: async () => [
    {
      source: '/(.*)',
      headers: securityHeaders,
    },
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: '*.vercel.app',
      },
    ],
  },
  experimental: {
    reactCompiler: false,
  },
};

export default withPayload(nextConfig);

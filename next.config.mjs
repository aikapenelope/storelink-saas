import { withPayload } from '@payloadcms/next/withPayload';

/**
 * Security headers fase 1 (plan docs/PLAN_ROBUSTECIMIENTO_v2.md, R7/C6):
 * - XFO/nosniff/HSTS/Referrer-Policy/Permissions-Policy se aplican en firme.
 * - La CSP va en modo Report-Only: una CSP restrictiva con script-src sin
 *   nonces rompería el admin de Payload (scripts inline de Next). Fase 2
 *   (backlog): endurecer script-src con nonces cuando el stack lo permita.
 * - img-src replica images.remotePatterns de abajo (+ blob:/data: para el PWA).
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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https://images.unsplash.com https://*.r2.cloudflarestorage.com https://*.supabase.co https://*.vercel.app",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
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

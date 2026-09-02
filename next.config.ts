import type { NextConfig } from 'next';
import { withPayload } from '@payloadcms/next/withPayload';
import { ALLOWED_IMAGE_HOST_SUFFIXES } from './src/lib/image-hosts';

/**
 * Security headers fase 1 (plan docs/PLAN_ROBUSTECIMIENTO_v2.md, R7/C6):
 * - XFO/nosniff/HSTS/Referrer-Policy/Permissions-Policy se aplican en firme.
 * - La CSP va en modo Report-Only: una CSP restrictiva con script-src sin
 *   nonces rompería el admin de Payload (scripts inline de Next). Fase 2
 *   (backlog): endurecer script-src con nonces cuando el stack lo permita.
 * - img-src replica images.remotePatterns de abajo (+ blob:/data: para el editor de imágenes del admin).
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
      "form-action 'self'",
      'upgrade-insecure-requests',
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

/**
 * Auditoría final 2026-09-01 (CRÍTICO): remotePatterns se DERIVA de la
 * whitelist única src/lib/image-hosts.ts. Antes la lista vivía solo aquí
 * mientras Products.ts aceptaba cualquier host http(s): una URL con host no
 * listado hacía que next/image lanzara en render y tumbaba el storefront
 * completo del tenant (500). Ahora la misma fuente alimenta la validación de
 * admin, el import de Sheets y esta config.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers: async () => [
    {
      source: '/(.*)',
      headers: securityHeaders,
    },
  ],
  images: {
    remotePatterns: ALLOWED_IMAGE_HOST_SUFFIXES.map((hostname) => ({
      protocol: 'https' as const,
      hostname: hostname.startsWith('images.') ? hostname : `*.${hostname}`,
    })),
  },
  experimental: {
    reactCompiler: false,
  },
};

export default withPayload(nextConfig);

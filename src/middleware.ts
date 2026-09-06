import { NextRequest, NextResponse } from 'next/server';
import { checkAuthIpRateLimit } from '@/lib/rate-limit';

/**
 * Rate-limit por IP para los endpoints REST nativos de auth de Payload que
 * no pasan por los guards propios del repo: /api/users/login,
 * forgot-password, reset-password y unlock. Payload 3 no incluye rate
 * limiter nativo (su control oficial es maxLoginAttempts/lockTime por
 * CUENTA, ya configurado en Users.ts — 5 intentos / 10 min) y ese lockout
 * no frena credential stuffing distribuido (muchas IPs × muchas cuentas)
 * ni el abuso del envío de correos de reset (coste Resend, sondeo de
 * cuentas): esa es la función de esta capa por IP.
 *
 * P2 hardening (auditoría 2026-09-05): el contador vivía en un Map EN
 * MEMORIA de cada instancia serverless — cota aproximada por instancia, no
 * global. Ahora usa el contador GLOBAL en Upstash (checkAuthIpRateLimit,
 * mismo módulo y patrón que el resto de los limiters del repo), con la
 * misma decisión de fail-open del dueño: un problema de Upstash nunca
 * bloquea un login legítimo y maxLoginAttempts sigue activo.
 */

function clientIp(req: NextRequest): string {
  // En Vercel, x-forwarded-for/x-real-ip son GESTIONADOS POR LA PLATAFORMA
  // (Vercel sobrescribe los que lleguen del cliente), así que no son
  // spoofables en este entorno — review Devin #73. En self-hosted detrás de
  // un proxy propio, confiar en estos headers exige sanitizarlos en el proxy.
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export async function middleware(req: NextRequest) {
  // Solo los endpoints que mutan estado de auth (todos son POST en Payload 3).
  if (req.method !== 'POST') {
    return NextResponse.next();
  }

  const verdict = await checkAuthIpRateLimit(clientIp(req));
  if (!verdict.allowed) {
    // Formato de error estándar de Payload (errors[]).
    return NextResponse.json(
      {
        errors: [{ message: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.' }],
      },
      { status: 429 },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/users/:path*',
};

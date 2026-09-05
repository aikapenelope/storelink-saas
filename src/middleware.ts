import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate-limit defensivo (auditoría 2026-09-04, P2) para los endpoints REST
 * nativos de Payload que no pasan por los guards propios del repo:
 * /api/users/login, /api/users/forgot-password, /api/users/reset-password y
 * /api/users/unlock. Payload 3 ya no incluye rate limiter nativo y el lockout
 * por cuenta (5 intentos / 10 min en Users.ts) no frena credential stuffing
 * distribuido (muchas IPs × muchas cuentas) ni el abuso del envío de correos
 * de reset (coste Resend, sondeo de cuentas).
 *
 * Limitación declarada: contador EN MEMORIA por instancia serverless (Vercel).
 * Es una cota aproximada por instancia, no un contador global; suficiente como
 * primera capa. Es fail-open por diseño (misma decisión documentada en
 * src/lib/rate-limit.ts): un problema de este middleware nunca debe bloquear
 * el login legítimo.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10; // login normal: unas pocas llamadas/min/IP
const MAX_MAP_ENTRIES = 5_000; // acota la memoria del mapa en abuse sustained

const hits = new Map<string, { count: number; resetAt: number }>();

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

function pruneExpired(now: number): void {
  if (hits.size < MAX_MAP_ENTRIES) return;
  for (const [key, entry] of hits) {
    if (entry.resetAt <= now) hits.delete(key);
  }
  // Review Devin #73: si aun así no bajó del cap (5000 IPs ACTIVAS en la
  // ventana), expulsa las entradas más antiguas (inserción) para que el mapa
  // tenga cota de memoria dura y los nuevos clientes igual queden limitados.
  while (hits.size >= MAX_MAP_ENTRIES) {
    const oldest = hits.keys().next().value;
    if (oldest === undefined) break;
    hits.delete(oldest);
  }
}

export function middleware(req: NextRequest) {
  // Solo los endpoints que mutan estado de auth (todos son POST en Payload 3).
  if (req.method !== 'POST') {
    return NextResponse.next();
  }

  const now = Date.now();
  const ip = clientIp(req);
  pruneExpired(now);

  const entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
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

import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@/payload.config';

// Runner externo de la Jobs Queue (red de seguridad para reintentos y
// fallos). Lo invoca GitHub Actions (cron */5) con el header x-cron-secret.
// En Hobby Vercel no permite crons nativos, y /api/payload-jobs/run exige
// sesión: esta ruta valida un secreto dedicado y ejecuta payload.jobs.run().
export async function GET(request: NextRequest) {
  const provided = request.headers.get('x-cron-secret');
  if (!provided || provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const payload = await getPayload({ config });
    const result = await payload.jobs.run({ queue: 'default' });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Jobs run error (external runner):', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
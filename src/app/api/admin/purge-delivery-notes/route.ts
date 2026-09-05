import { NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/cron-secret';
import { DELIVERY_NOTE_RETENTION_DAYS, purgeOldDeliveryNotes } from '@/lib/delivery-note';

/**
 * Purga diaria de Notas de Entrega >180d (auditoría 2026-09-04, P1-12: los
 * PDF con PII del cliente vivían en R2 indefinidamente). Llamado por el
 * workflow diario .github/workflows/jobs-daily.yml con x-cron-secret.
 * En el flujo normal la anonimización de clientes borra los PDF activos;
 * esta purga cubre los pedidos históricos.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request.headers.get('x-cron-secret'))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const result = await purgeOldDeliveryNotes(DELIVERY_NOTE_RETENTION_DAYS);
  return NextResponse.json({
    ok: true,
    purged: result.purged,
    skipped: result.skipped,
    retentionDays: DELIVERY_NOTE_RETENTION_DAYS,
  });
}

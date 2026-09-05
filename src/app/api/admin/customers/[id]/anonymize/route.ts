import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { anonymizeCustomer } from '@/lib/privacy';
import { checkAdminRouteRateLimit } from '@/lib/rate-limit';

/**
 * Derecho al olvido (auditoría 2026-09-04, P1-12): anonimiza la PII de un
 * cliente (nombre, email, teléfono, direcciones, historial, notas) preservando
 * los agregados monetarios del CRM, y borra sus Notas de Entrega en R2.
 *
 * Auth: sesión obligatoria; el access de la colección (hasTenantAccess)
 * acota al tenant-admin a SUS clientes vía overrideAccess:false + user
 * (patrón Local API de docs/local-api). Cota anti-abuso: 5/min por usuario.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await getPayload({ config });

    const { user } = await payload.auth({ headers: request.headers });
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const rlVerdict = await checkAdminRouteRateLimit('anonymize-customer', user.id);
    if (!rlVerdict.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas operaciones seguidas. Espera un minuto e inténtalo de nuevo.' },
        { status: 429 }
      );
    }

    const customerId = Number(id);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      return NextResponse.json({ error: 'Identificador de cliente inválido' }, { status: 400 });
    }

    const result = await anonymizeCustomer({
      payload,
      req: {
        user,
        context: {},
        headers: request.headers,
      } as never,
      customerId,
    });

    return NextResponse.json({
      ok: true,
      anonymizedFields: result.anonymizedFields,
      deliveryNotesDeleted: result.deliveryNotesDeleted,
    });
  } catch (err) {
    // Mensaje controlado: no filtrar detalles internos ni PII del error crudo.
    const message = err instanceof Error ? err.message : '';
    if (message.includes('no encontrado')) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }
    console.error('[storelink][privacy] anonimización falló:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json(
      { error: 'No se pudo anonimizar al cliente. Inténtalo de nuevo.' },
      { status: 500 }
    );
  }
}

'use client';

/**
 * Polling del resultado de un import de catálogo (review Devin #72).
 *
 * Las rutas import-csv/sync-sheets responden 202 + jobId y procesan en
 * background. Este helper consulta /api/[tenant]/import-status hasta que el
 * job llega a estado terminal (o vence el timeout) y devuelve un mensaje listo
 * para mostrar al comerciante, incluida la advertencia de imágenes
 * descartadas por host no permitido (rejectedImageUrls).
 */

export interface ImportOutput {
  created?: number;
  updated?: number;
  errorCount?: number;
  rejectedImageUrls?: number;
}

export interface ImportOutcome {
  /** completed | error | background (sigue procesando o venció el polling) */
  status: 'completed' | 'error' | 'background';
  summary: { success: boolean; message: string };
}

const DEFAULT_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 30000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildOutcome(status: 'completed' | 'error', output?: ImportOutput): ImportOutcome {
  if (status === 'error') {
    return {
      status: 'error',
      summary: {
        success: false,
        message:
          'El import terminó con errores después de varios reintentos. Revisa el formato del archivo o la hoja e inténtalo de nuevo.',
      },
    };
  }

  const o = output ?? {};
  const created = o.created ?? 0;
  const updated = o.updated ?? 0;
  const rejected = o.rejectedImageUrls ?? 0;
  let message = `¡Importación completada! ${created} producto(s) creado(s), ${updated} actualizado(s).`;
  if (rejected > 0) {
    message += ` ⚠️ ${rejected} URL(s) de imagen fueron descartadas por host no permitido (solo se aceptan Unsplash, R2, martes.app, Google/Drive directo, Cloudinary, Imgur, Shopify, Supabase o Vercel).`;
  }
  return { status: 'completed', summary: { success: true, message } };
}

export async function pollImportCompletion(
  tenantSlug: string,
  jobId: string,
  opts?: { intervalMs?: number; timeoutMs?: number }
): Promise<ImportOutcome> {
  const intervalMs = opts?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const deadline = Date.now() + (opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    try {
      const res = await fetch(
        `/api/${tenantSlug}/import-status?jobId=${encodeURIComponent(jobId)}`,
        { cache: 'no-store' }
      );

      if (res.ok) {
        const data = (await res.json()) as { status?: string; output?: ImportOutput };
        if (data.status === 'completed' || data.status === 'error') {
          return buildOutcome(data.status, data.output);
        }
        // queued/running: seguir esperando
      } else if (res.status === 404) {
        // Job inexistente/ajeno/purgado: no hay nada que esperar.
        return {
          status: 'background',
          summary: {
            success: true,
            message:
              'El import ya no está en la cola. El catálogo se actualizará en unos segundos.',
          },
        };
      }
      // 401/5xx: reintentar hasta el timeout (puede ser un cold start).
    } catch {
      // Error de red: reintentar hasta el timeout.
    }
  }

  return {
    status: 'background',
    summary: {
      success: true,
      message:
        'El import sigue procesándose en segundo plano (catálogo grande). El catálogo se actualizará en unos minutos.',
    },
  };
}
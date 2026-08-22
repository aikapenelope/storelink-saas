import type { TaskConfig } from 'payload';
import { syncCatalogFromCsv, sheetsUrlToCsvExport } from '../lib/sheets-sync';

export const DAILY_SHEETS_SYNC_CRON = '0 12 * * *'; // Todos los días 12:00 UTC

/**
 * Task oficial del Jobs Queue de Payload (docs/jobs-queue/tasks).
 * Sincroniza el catálogo de un tenant desde su Google Sheet.
 * El schedule (cron) solo ENCOLA; la ejecución real corre vía
 * /api/payload-jobs/run (Vercel Cron) o autoRun.
 */
export const syncTenantCatalogTask: TaskConfig = {
  slug: 'syncTenantCatalog',
  label: 'Sincronizar catálogo desde Google Sheets',
  schedule: [
    {
      cron: DAILY_SHEETS_SYNC_CRON,
      queue: 'sheets-sync',
    },
  ],
  inputSchema: [
    {
      name: 'tenantId',
      type: 'text', // numeric ID como string para compatibilidad JSON
      required: true,
    },
  ],
  // Field[] oficial: Payload genera el tipo de output desde estos campos
  outputSchema: [
    { name: 'created', type: 'number' },
    { name: 'updated', type: 'number' },
    { name: 'skipped', type: 'number' },
    { name: 'errors', type: 'number' },
    { name: 'message', type: 'text' },
  ],
  handler: async ({ input, req }) => {
    const payload = req.payload;
    const tenantId = input?.tenantId;

    const tenant = await payload.findByID({
      collection: 'tenants',
      id: String(tenantId),
      depth: 0,
    } as any);

    if (!tenant) throw new Error(`Tenant ${tenantId} no encontrado`);
    if ((tenant as any).sheetsSyncEnabled === false || !(tenant as any).sheetsSyncUrl) {
      return { output: { created: 0, updated: 0, skipped: 0, errors: 0 }, message: 'Sync deshabilitado o sin URL' };
    }

    const csvUrl = sheetsUrlToCsvExport((tenant as any).sheetsSyncUrl);
    if (!csvUrl) throw new Error('URL de Google Sheets inválida');

    const res = await fetch(csvUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`No se pudo descargar el Sheet (HTTP ${res.status}). ¿Está público?`);
    const csvText = await res.text();
    if (!csvText.trim()) throw new Error('La hoja está vacía');

    const result = await syncCatalogFromCsv(payload, tenantId, csvText);

    // Registrar resultado en el tenant (auditoría desde el panel)
    try {
      await payload.update({
        collection: 'tenants',
        id: String(tenantId),
        data: {
          syncLastStatus: result.errors.length > 0 ? 'partial_error' : 'ok',
          syncLastRunAt: new Date().toISOString(),
          syncLastResult: {
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            errorCount: result.errors.length,
            lastErrors: result.errors.slice(0, 5),
          },
        },
        depth: 0,
        overrideAccess: true,
        context: { disableRevalidate: false },
      } as any);
    } catch {
      // No bloquear por fallo de auditoría
    }

    // Invalidar caché del storefront
    try {
      const { revalidatePath } = await import('next/cache');
      revalidatePath(`/${(tenant as any).slug}`);
    } catch {}

    return {
      output: {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
      },
      message: `Sync ${result.errors.length > 0 ? 'con errores' : 'exitoso'}: +${result.created} creados, ~${result.updated} actualizados`,
    };
  },
};

/**
 * Encola jobs de sync para TODOS los tenants con sync habilitado.
 * Lo llama el endpoint de Vercel Cron una vez al día.
 */
export async function queueAllSheetsSyncs(payload: {
  find: Function;
  jobs: { queue: Function };
}): Promise<{ queued: number }> {
  const tenants = await payload.find({
    collection: 'tenants',
    where: { sheetsSyncEnabled: { equals: true } },
    limit: 500,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  } as any);

  let queued = 0;
  for (const t of tenants.docs as Array<any>) {
    if (!t.sheetsSyncUrl) continue;
    await payload.jobs.queue({
      task: 'syncTenantCatalog',
      input: { tenantId: String(t.id) },
      queue: 'sheets-sync',
      overrideAccess: true,
    });
    queued++;
  }
  return { queued };
}

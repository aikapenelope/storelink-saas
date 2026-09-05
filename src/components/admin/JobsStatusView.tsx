import React from 'react';
import { headers } from 'next/headers';
import { getPayload } from 'payload';
import config from '@payload-config';
import { Clock, AlertCircle, CheckCircle } from 'lucide-react';

type JobStatus = {
  id: string;
  workflow: string;
  hasError: boolean;
  createdAt: string;
  updatedAt: string;
  input: Record<string, unknown>;
  error?: string;
};

export async function JobsStatusView() {
  const payload = await getPayload({ config });

  // Auditoría 2026-09-04 (P3): la vista leía payload-jobs vía payload.db
  // (bypass de access control) SIN filtro de tenant — un tenant-admin veía los
  // jobs (orderIds, errores) de TODA la plataforma. El dashboard es global:
  // solo super-admin.
  const authResult = await payload.auth({ headers: await headers() });
  const viewerRole = (authResult?.user as { role?: string } | undefined)?.role;
  if (viewerRole !== 'super-admin') {
    return (
      <section className="border border-zinc-800 bg-zinc-950 p-5 shadow-xl rounded-none">
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span className="text-xs">El estado de la cola de jobs solo está disponible para el administrador de la plataforma.</span>
        </div>
      </section>
    );
  }

  try {
    // Acceder a la colección interna de Payload Jobs
    const jobsRes = await (payload.db as unknown as { 
      find: (args: { collection: string; where?: Record<string, unknown>; limit?: number; sort?: string }) => Promise<{ docs: JobStatus[] }>
    }).find({
      collection: 'payload-jobs',
      where: {
        workflow: { equals: 'order-created' }
      },
      limit: 10,
      sort: '-createdAt'
    });

    const jobs = jobsRes.docs || [];
    const failedJobs = jobs.filter((job) => job.hasError);
    const recentJobs = jobs.slice(0, 5);

    return (
      <section className="border border-zinc-800 bg-zinc-950 p-5 shadow-xl rounded-none">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Estado de Jobs</h3>
          </div>
          <div className="flex items-center gap-2">
            {failedJobs.length > 0 && (
              <div className="flex items-center gap-1.5 bg-red-950/50 border border-red-900 px-2 py-1 rounded-none">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-mono text-red-300">{failedJobs.length} fallidos</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 px-2 py-1 rounded-none">
              <span className="text-xs font-mono text-zinc-300">{jobs.length} totales</span>
            </div>
          </div>
        </div>

        {failedJobs.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400 mb-3">Jobs fallidos recientes (requieren atención):</p>
            {failedJobs.slice(0, 3).map((job) => (
              <div key={job.id} className="flex items-start gap-3 p-3 bg-red-950/20 border border-red-900/50 rounded-none">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-mono text-red-300">{job.workflow}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(job.createdAt).toLocaleString('es-VE')}
                    </span>
                  </div>
                  {job.error && (
                    <p className="text-xs text-red-400/80 truncate">{job.error}</p>
                  )}
                  <p className="text-[10px] text-zinc-500 font-mono mt-1">ID: {job.id}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-4 bg-green-950/20 border border-green-900/50 rounded-none">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <p className="text-xs text-green-300">Todos los jobs recientes completados exitosamente</p>
          </div>
        )}

        {recentJobs.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-400 mb-2">Jobs recientes:</p>
            <div className="space-y-1">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-2 bg-zinc-900/50 border border-zinc-800 rounded-none">
                  <div className="flex items-center gap-2">
                    {job.hasError ? (
                      <AlertCircle className="w-3 h-3 text-red-400" />
                    ) : (
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    )}
                    <span className="text-xs font-mono text-zinc-300">{job.workflow}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {new Date(job.createdAt).toLocaleString('es-VE')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  } catch (error) {
    console.error('Error fetching jobs status:', error);
    return (
      <section className="border border-zinc-800 bg-zinc-950 p-5 shadow-xl rounded-none">
        <div className="flex items-center gap-2 text-zinc-400">
          <AlertCircle className="w-4 h-4" />
          <p className="text-xs">No se pudo cargar el estado de jobs</p>
        </div>
      </section>
    );
  }
}

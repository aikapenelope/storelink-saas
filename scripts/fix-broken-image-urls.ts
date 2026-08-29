import { getPayload } from 'payload';
import config from '@payload-config';
import { revalidatePath } from 'next/cache';
import { sanitizeCsvCell } from '@/lib/csv';

async function fixBrokenImageUrls() {
  console.log('Iniciando reparación de imageUrls en colección Products...');
  const payload = await getPayload({ config });

  const tenants = new Set<string>();
  let fixedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await payload.find({
      collection: 'products',
      limit: 100,
      page,
      depth: 0,
      overrideAccess: true,
    });

    for (const product of res.docs) {
      const rawImageUrls = product.imageUrls;
      if (!Array.isArray(rawImageUrls) || rawImageUrls.length === 0) continue;

      const hasCompound = rawImageUrls.some(
        (url) => typeof url === 'string' && /[,;\n\r]/.test(url)
      );
      if (!hasCompound) continue;

      const cleanedUrls: string[] = [];
      for (const entry of rawImageUrls) {
        if (typeof entry !== 'string') continue;
        const parts = entry
          .split(/[,;\n\r]+/)
          .map((u) => sanitizeCsvCell(u).trim())
          .filter(Boolean);
        cleanedUrls.push(...parts);
      }
      const finalUrls = Array.from(new Set(cleanedUrls)).slice(0, 6);

      const validUrls: string[] = [];
      const invalidUrls: string[] = [];
      for (const url of finalUrls) {
        try {
          const parsed = new URL(url);
          if (parsed.protocol.startsWith('http')) validUrls.push(url);
          else invalidUrls.push(url);
        } catch {
          invalidUrls.push(url);
        }
      }
      if (invalidUrls.length > 0) {
        console.warn(`[ADVERTENCIA] SKU: ${product.sku} contiene URLs irrecuperables:`, invalidUrls);
      }

      if (validUrls.length === 0) {
        skippedCount++;
        console.warn(`! SKU: ${product.sku} no tuvo URLs válidas tras la división.`);
        continue;
      }

      try {
        await payload.update({
          collection: 'products',
          id: product.id,
          overrideAccess: true,
          context: { skipRevalidate: true },
          data: { imageUrls: validUrls },
        });
        fixedCount++;
        console.log(`✓ SKU: ${product.sku} actualizado con ${validUrls.length} URLs válidas.`);

        if (product.tenant) {
          const tenantId = typeof product.tenant === 'object' ? (product.tenant as { id: number | string }).id : product.tenant;
          const tenantDoc = await payload
            .findByID({ collection: 'tenants', id: Number(tenantId), depth: 0, overrideAccess: true })
            .catch(() => null);
          if (tenantDoc && typeof tenantDoc === 'object' && 'slug' in tenantDoc && tenantDoc.slug) {
            tenants.add(tenantDoc.slug as string);
          }
        }
      } catch (updateErr) {
        errorCount++;
        console.error(`✗ Error actualizando SKU: ${product.sku}:`, updateErr);
      }
    }

    hasMore = res.hasNextPage;
    page++;
  }

  for (const slug of tenants) {
    try {
      revalidatePath(`/${slug}`);
      console.log(`[REVALIDATED] Storefront: /${slug}`);
    } catch {
      // Ignorar fuera de contexto HTTP
    }
  }

  console.log('\n--- Resumen de reparación ---');
  console.log(`Total productos corregidos: ${fixedCount}`);
  console.log(`Total productos saltados / sin URL válida: ${skippedCount}`);
  console.log(`Errores: ${errorCount}`);
}

if (require.main === module) {
  fixBrokenImageUrls()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error fatal en el script de reparación:', err);
      process.exit(1);
    });
}

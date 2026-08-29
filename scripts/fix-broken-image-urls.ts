import { getPayload } from 'payload';
import config from '@payload-config';
import { sanitizeCsvCell } from '@/lib/csv';

/**
 * Script de reparación puntual para productos con URLs de imagen rotas
 * originadas por el backfill de la migración 20260829_products_image_urls.ts
 * (donde strings con comas como "url1,url2" se guardaron como un solo elemento).
 *
 * Utiliza exclusivamente Payload Local API (principio 1.1 de la Constitución)
 * para garantizar que las actualizaciones respeten el ciclo de vida y validaciones.
 */
async function fixBrokenImageUrls() {
  console.log('Iniciando saneamiento de imageUrls en la colección products...');
  const payload = await getPayload({ config });

  // 1. Obtener todos los productos (hasta 5000)
  const productsResult = await payload.find({
    collection: 'products',
    limit: 5000,
    depth: 0,
    overrideAccess: true,
  });

  let fixedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const product of productsResult.docs) {
    const rawImageUrls = product.imageUrls;
    if (!Array.isArray(rawImageUrls) || rawImageUrls.length === 0) {
      continue;
    }

    // Verificar si alguna entrada contiene coma, punto y coma o espacio sobrante
    const hasCommaOrSeparator = rawImageUrls.some(
      (url) => typeof url === 'string' && /[,;\n\r]/.test(url)
    );

    if (!hasCommaOrSeparator) {
      continue;
    }

    console.log(`Reparando SKU: ${product.sku} (ID: ${product.id})...`);

    // Reutilizar la lógica de división y sanitización estándar
    const cleanedUrls: string[] = [];
    for (const entry of rawImageUrls) {
      if (typeof entry !== 'string') continue;
      const parts = entry
        .split(/[,;\n\r]+/)
        .map((u) => sanitizeCsvCell(u).trim())
        .filter(Boolean);
      cleanedUrls.push(...parts);
    }

    const finalUrls = cleanedUrls.slice(0, 6);

    // Validar formato de cada URL individual
    const validUrls: string[] = [];
    const invalidUrls: string[] = [];

    for (const url of finalUrls) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol.startsWith('http')) {
          validUrls.push(url);
        } else {
          invalidUrls.push(url);
        }
      } catch {
        invalidUrls.push(url);
      }
    }

    if (invalidUrls.length > 0) {
      console.warn(
        `[ADVERTENCIA] SKU: ${product.sku} contiene URLs irrecuperables:`,
        invalidUrls
      );
    }

    if (validUrls.length > 0) {
      try {
        await payload.update({
          collection: 'products',
          id: product.id,
          data: {
            imageUrls: validUrls,
          },
          overrideAccess: true,
        });
        fixedCount++;
        console.log(`✓ SKU: ${product.sku} actualizado con ${validUrls.length} URLs válidas.`);
      } catch (updateErr) {
        errorCount++;
        console.error(`✗ Error actualizando SKU: ${product.sku}:`, updateErr);
      }
    } else {
      skippedCount++;
      console.warn(`! SKU: ${product.sku} no tuvo URLs válidas tras la división.`);
    }
  }

  console.log('\n--- Resumen de reparación ---');
  console.log(`Total productos corregidos: ${fixedCount}`);
  console.log(`Total productos saltados / sin URL válida: ${skippedCount}`);
  console.log(`Errores: ${errorCount}`);
  console.log('Saneamiento completado.');
}

if (require.main === module) {
  fixBrokenImageUrls()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error fatal en el script de reparación:', err);
      process.exit(1);
    });
}

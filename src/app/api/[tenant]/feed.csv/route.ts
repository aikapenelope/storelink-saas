import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@/payload.config';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant: tenantSlug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://storelink-saas.vercel.app';

  let products = [
    {
      id: 'PIZ-001',
      title: 'Pizza Margarita Artesanal',
      description: 'Salsa de tomate San Marzano, mozzarella fresca di bufala, albahaca y aceite de oliva virgen extra.',
      availability: 'in stock',
      condition: 'new',
      price: '12.50 USD',
      link: `${baseUrl}/${tenantSlug}`,
      image_link: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80',
      brand: tenantSlug.toUpperCase(),
    },
    {
      id: 'PIZ-002',
      title: 'Pizza Cuatro Quesos',
      description: 'Mozzarella, gorgonzola, parmesano reggiano y queso de cabra con toque de orégano.',
      availability: 'in stock',
      condition: 'new',
      price: '14.00 USD',
      link: `${baseUrl}/${tenantSlug}`,
      image_link: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
      brand: tenantSlug.toUpperCase(),
    },
  ];

  try {
    const payload = await getPayload({ config });

    const tenantResult = await payload.find({
      collection: 'tenants',
      where: {
        slug: {
          equals: tenantSlug,
        },
      },
      limit: 1,
    });

    if (tenantResult.docs.length > 0) {
      const doc = tenantResult.docs[0] as any;
      const currency = doc.currency || 'USD';
      const brand = (doc.name || tenantSlug).toUpperCase();

      const productsResult = await payload.find({
        collection: 'products',
        where: {
          tenant: {
            equals: doc.id,
          },
        },
        limit: 500,
      });

      if (productsResult.docs.length > 0) {
        products = productsResult.docs.map((p: any) => {
          const rawPrice = Number(p.price) || 0;
          const formattedPrice = `${rawPrice.toFixed(2)} ${currency}`;
          const isOutOfStock = p.stockStatus === 'out_of_stock';
          const availability = isOutOfStock ? 'out of stock' : 'in stock';
          const imgUrl = Array.isArray(p.images) && p.images[0]
            ? p.images[0].image?.url || p.images[0].image_url || p.images[0].url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'
            : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

          return {
            id: p.sku || `SKU-${p.id}`,
            title: p.title,
            description: p.description || p.title,
            availability,
            condition: 'new',
            price: formattedPrice,
            link: `${baseUrl}/${tenantSlug}`,
            image_link: imgUrl,
            brand,
          };
        });
      }
    }
  } catch (err) {
    console.error('Error querying products for feed.csv:', err);
  }

  // Meta Commerce Catalog CSV Standard Headers
  const headers = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand'];

  const rows = products.map((p) => [
    `"${p.id}"`,
    `"${p.title.replace(/"/g, '""')}"`,
    `"${p.description.replace(/"/g, '""')}"`,
    `"${p.availability}"`,
    `"${p.condition}"`,
    `"${p.price}"`,
    `"${p.link}"`,
    `"${p.image_link}"`,
    `"${p.brand}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${tenantSlug}-meta-catalog.csv"`,
      'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=600',
    },
  });
}

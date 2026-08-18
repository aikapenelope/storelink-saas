import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://storelink-saas.vercel.app';

  // Sample catalog rows for demo/seed (in production queries Payload DB by tenant slug)
  const products = [
    {
      id: 'PIZ-001',
      title: 'Pizza Margarita Artesanal',
      description: 'Salsa de tomate San Marzano, mozzarella fresca di bufala, albahaca y aceite de oliva virgen extra.',
      availability: 'in stock',
      condition: 'new',
      price: '12.50 USD',
      link: `${baseUrl}/${tenant}`,
      image_link: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80',
      brand: tenant.toUpperCase(),
    },
    {
      id: 'PIZ-002',
      title: 'Pizza Cuatro Quesos',
      description: 'Mozzarella, gorgonzola, parmesano reggiano y queso de cabra con toque de orégano.',
      availability: 'in stock',
      condition: 'new',
      price: '14.00 USD',
      link: `${baseUrl}/${tenant}`,
      image_link: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
      brand: tenant.toUpperCase(),
    },
    {
      id: 'BEB-001',
      title: 'Coca-Cola Original 1.5L',
      description: 'Bebida gaseosa refrescante bien fría.',
      availability: 'in stock',
      condition: 'new',
      price: '3.50 USD',
      link: `${baseUrl}/${tenant}`,
      image_link: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
      brand: tenant.toUpperCase(),
    },
    {
      id: 'POS-001',
      title: 'Tiramisú Tradicional Italiano',
      description: 'Bizcocho savoiardi bañado en espresso, crema de mascarpone y cacao puro.',
      availability: 'in stock',
      condition: 'new',
      price: '5.50 USD',
      link: `${baseUrl}/${tenant}`,
      image_link: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=600&q=80',
      brand: tenant.toUpperCase(),
    },
  ];

  // CSV Header required by Meta Commerce Manager
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
      'Content-Disposition': `attachment; filename="${tenant}-meta-catalog.csv"`,
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

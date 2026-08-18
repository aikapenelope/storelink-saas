import React from 'react';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { StorefrontClient, type ProductItem, type TenantConfig } from '@/components/storefront-client';

export const dynamic = 'force-dynamic';

const DEMO_PRODUCTS: ProductItem[] = [
  {
    id: 'p1',
    sku: 'PIZ-001',
    title: 'Pizza Margarita Artesanal',
    price: 12.5,
    description: 'Salsa de tomate San Marzano, mozzarella fresca di bufala, albahaca y aceite de oliva virgen extra.',
    category: { id: 'c1', name: 'Pizzas' },
    stockStatus: 'in_stock',
    featured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80' }],
  },
  {
    id: 'p2',
    sku: 'PIZ-002',
    title: 'Pizza Cuatro Quesos',
    price: 14.0,
    description: 'Mozzarella, gorgonzola, parmesano reggiano y queso de cabra con toque de orégano.',
    category: { id: 'c1', name: 'Pizzas' },
    stockStatus: 'in_stock',
    featured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80' }],
  },
  {
    id: 'p3',
    sku: 'BEB-001',
    title: 'Coca-Cola Original 1.5L',
    price: 3.5,
    description: 'Bebida gaseosa refrescante bien fría.',
    category: { id: 'c2', name: 'Bebidas' },
    stockStatus: 'in_stock',
    featured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80' }],
  },
  {
    id: 'p4',
    sku: 'POS-001',
    title: 'Tiramisú Tradicional Italiano',
    price: 5.5,
    description: 'Bizcocho savoiardi bañado en espresso, crema de mascarpone y cacao puro.',
    category: { id: 'c3', name: 'Postres' },
    stockStatus: 'in_stock',
    featured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=600&q=80' }],
  },
];

export default async function TenantStorefrontPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;

  if (tenantSlug === 'admin') {
    return null;
  }

  let tenantConfig: TenantConfig = {
    id: 'demo-tenant',
    name: tenantSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    slug: tenantSlug,
    whatsappPhone: '34600123456',
    welcomeMessage: 'Catálogo interactivo con pedidos por WhatsApp',
  };

  let products: ProductItem[] = DEMO_PRODUCTS;
  let categories: string[] = ['Todos', 'Pizzas', 'Bebidas', 'Postres'];

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
      tenantConfig = {
        id: String(doc.id),
        name: doc.name || tenantConfig.name,
        slug: doc.slug || tenantSlug,
        whatsappPhone: doc.whatsappPhone || '34600123456',
        welcomeMessage: doc.branding?.welcomeMessage || undefined,
        primaryColor: doc.branding?.primaryColor || undefined,
        trelloConfig: doc.trelloConfig || undefined,
      };

      // Fetch products for this tenant
      const productsResult = await payload.find({
        collection: 'products',
        where: {
          tenant: {
            equals: doc.id,
          },
        },
        limit: 100,
      });

      if (productsResult.docs.length > 0) {
        products = productsResult.docs.map((p: any) => ({
          id: String(p.id),
          sku: p.sku || `SKU-${p.id}`,
          title: p.title,
          price: Number(p.price) || 0,
          description: p.description || '',
          category: p.category
            ? {
                id: String(p.category.id || p.category),
                name: p.category.name || 'General',
              }
            : undefined,
          stockStatus: p.stockStatus || 'in_stock',
          featured: Boolean(p.featured),
          images: Array.isArray(p.images)
            ? p.images.map((img: any) => ({
                url:
                  img.image?.url ||
                  img.image_url ||
                  img.url ||
                  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
              }))
            : [],
        }));

        // Dynamic categories from loaded products
        const catSet = new Set<string>(['Todos']);
        products.forEach((p) => {
          if (p.category?.name) catSet.add(p.category.name);
        });
        categories = Array.from(catSet);
      }
    }
  } catch (err) {
    console.error('Error fetching tenant products from Payload:', err);
  }

  return (
    <StorefrontClient
      tenant={tenantConfig}
      products={products}
      categories={categories}
    />
  );
}

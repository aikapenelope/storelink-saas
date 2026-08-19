import React from 'react';
import type { Metadata } from 'next';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { getLiveExchangeRate } from '@/lib/exchange-rate';
import {
  StorefrontClient,
  type ProductItem,
  type TenantConfig,
} from '@/components/storefront-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: tenantSlug } = await params;
  const storeName = tenantSlug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

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
      const title = doc.meta?.title || `${doc.name || storeName} | Catálogo Online Oficial`;
      const description =
        doc.meta?.description ||
        doc.branding?.welcomeMessage ||
        `Haz tus pedidos online en ${doc.name || storeName} con entregas rápidas y atención directa por WhatsApp.`;
      const logoUrl = doc.branding?.logo?.url || undefined;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          url: `https://storelink-saas.vercel.app/${tenantSlug}`,
          siteName: doc.name || storeName,
          images: logoUrl ? [{ url: logoUrl }] : [],
          type: 'website',
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: logoUrl ? [logoUrl] : [],
        },
      };
    }
  } catch (err) {
    console.error('Error generating metadata:', err);
  }

  return {
    title: `${storeName} | Catálogo y Pedidos Online`,
    description: `Catálogo interactivo con pedidos directos por WhatsApp para ${storeName}.`,
  };
}

const DEMO_PRODUCTS: ProductItem[] = [
  {
    id: 'p1',
    sku: 'PIZ-001',
    title: 'Pizza Margarita Artesanal',
    price: 12.5,
    description:
      'Salsa de tomate San Marzano, mozzarella fresca di bufala, albahaca y aceite de oliva virgen extra.',
    category: { id: 'c1', name: 'Pizzas' },
    stockStatus: 'in_stock',
    featured: true,
    variants: [
      { name: 'Mediana (6 porciones)', sku: 'PIZ-001-M', price: 12.5, stockStatus: 'in_stock' },
      { name: 'Familiar (8 porciones)', sku: 'PIZ-001-L', price: 16.0, stockStatus: 'in_stock' },
    ],
    modifiers: [
      {
        groupName: 'Elige tu borde de masa',
        options: [
          { name: 'Borde Tradicional', priceDelta: 0 },
          { name: 'Borde Relleno de Queso', priceDelta: 2.5 },
        ],
      },
    ],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80',
      },
    ],
  },
  {
    id: 'p2',
    sku: 'PIZ-002',
    title: 'Pizza Cuatro Quesos',
    price: 14.0,
    description:
      'Mozzarella, gorgonzola, parmesano reggiano y queso de cabra con toque de orégano.',
    category: { id: 'c1', name: 'Pizzas' },
    stockStatus: 'in_stock',
    featured: false,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
      },
    ],
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
    images: [
      {
        url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
      },
    ],
  },
  {
    id: 'p4',
    sku: 'POS-001',
    title: 'Tiramisú Tradicional Italiano',
    price: 5.5,
    description:
      'Bizcocho savoiardi bañado en espresso, crema de mascarpone y cacao puro.',
    category: { id: 'c3', name: 'Postres' },
    stockStatus: 'in_stock',
    featured: true,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=600&q=80',
      },
    ],
  },
  {
    id: 'p5',
    sku: 'BUR-001',
    title: 'Smash Burger Doble con Cheddar',
    price: 9.5,
    description:
      'Doble carne angus madurada, doble queso cheddar fundido, cebolla caramelizada y salsa secreta en pan brioche.',
    category: { id: 'c4', name: 'Hamburguesas' },
    stockStatus: 'in_stock',
    featured: true,
    variants: [
      { name: 'Simple (1 carne)', sku: 'BUR-001-S', price: 7.5, stockStatus: 'in_stock' },
      { name: 'Doble (2 carnes)', sku: 'BUR-001-D', price: 9.5, stockStatus: 'in_stock' },
      { name: 'Triple (3 carnes)', sku: 'BUR-001-T', price: 12.0, stockStatus: 'in_stock' },
    ],
    modifiers: [
      {
        groupName: 'Extras irresistibles',
        options: [
          { name: 'Bacon Ahumado Crujiente', priceDelta: 1.5 },
          { name: 'Huevo Frito a la Plancha', priceDelta: 1.0 },
          { name: 'Pepinillos Dulces Extra', priceDelta: 0.5 },
        ],
      },
    ],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
      },
    ],
  },
  {
    id: 'p6',
    sku: 'PAS-001',
    title: 'Fettuccine Alfredo con Trufa',
    price: 13.5,
    description:
      'Pasta fresca al huevo con salsa cremosa de mantequilla de trufa negra y parmesano de 24 meses.',
    category: { id: 'c5', name: 'Pastas' },
    stockStatus: 'in_stock',
    featured: false,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&w=600&q=80',
      },
    ],
  },
  {
    id: 'p7',
    sku: 'BEB-002',
    title: 'Limonada de Coco Helada',
    price: 4.0,
    description:
      'Zumo de limón fresco batido con crema de coco cremosa y hielo frapé.',
    category: { id: 'c2', name: 'Bebidas' },
    stockStatus: 'in_stock',
    featured: false,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
      },
    ],
  },
  {
    id: 'p8',
    sku: 'ROP-001',
    title: 'Camiseta Oversize Heavyweight Minimal',
    price: 28.0,
    description:
      'Algodón orgánico 260 GSM con corte holgado y costuras reforzadas.',
    category: { id: 'c6', name: 'Colección' },
    stockStatus: 'in_stock',
    featured: true,
    variants: [
      { name: 'Talla S - Negro', sku: 'ROP-001-S-BLK', price: 28.0, stockStatus: 'in_stock' },
      { name: 'Talla M - Negro', sku: 'ROP-001-M-BLK', price: 28.0, stockStatus: 'in_stock' },
      { name: 'Talla L - Negro', sku: 'ROP-001-L-BLK', price: 28.0, stockStatus: 'in_stock' },
      { name: 'Talla XL - Negro', sku: 'ROP-001-XL-BLK', price: 28.0, stockStatus: 'in_stock' },
    ],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
      },
    ],
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

  // Fetch live exchange rate from Binance / Paralelo API
  const liveRate = await getLiveExchangeRate('binance');

  let tenantConfig: TenantConfig = {
    id: 'demo-tenant',
    name: tenantSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    slug: tenantSlug,
    whatsappPhone: '34600123456',
    welcomeMessage: 'Catálogo interactivo con pedidos por WhatsApp',
    exchangeRateVES: liveRate,
    showVES: true,
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
        theme: doc.theme || 'basic-banner',
        whatsappPhone: doc.whatsappPhone || '34600123456',
        welcomeMessage: doc.branding?.welcomeMessage || undefined,
        primaryColor: doc.branding?.primaryColor || undefined,
        exchangeRateVES: Number(doc.branding?.exchangeRateVES) > 0 ? Number(doc.branding.exchangeRateVES) : liveRate,
        showVES: doc.branding?.showVES ?? true,
        // trelloConfig intentionally NOT passed to client — read server-side in checkout action
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
          trackStock: Boolean(p.trackStock),
          stockQuantity: p.stockQuantity ? Number(p.stockQuantity) : undefined,
          featured: Boolean(p.featured),
          variants: Array.isArray(p.variants) ? p.variants : [],
          modifiers: Array.isArray(p.modifiers) ? p.modifiers : [],
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

import React from 'react';
import type { Metadata } from 'next';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { getLiveExchangeRate } from '@/lib/exchange-rate';
import type { Tenant } from '@/payload-types';
import {
  StorefrontClient,
  type ProductItem,
  type TenantConfig,
} from '@/components/storefront-client';

import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

const RESERVED_SLUGS = new Set([
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'apple-touch-icon.png',
  'apple-touch-icon-precomposed.png',
  'manifest.json',
  'admin',
  'api',
]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: tenantSlug } = await params;
  if (RESERVED_SLUGS.has(tenantSlug)) {
    return { title: 'Not Found' };
  }

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
      const doc = tenantResult.docs[0] as Tenant;
      const title = doc.meta?.title || `${doc.name || storeName} | Catálogo Online Oficial`;
      const description =
        doc.meta?.description ||
        doc.branding?.welcomeMessage ||
        `Haz tus pedidos online en ${doc.name || storeName} con entregas rápidas y atención directa por WhatsApp.`;
      const logoUrl =
        typeof doc.branding?.logo === 'object' && doc.branding?.logo?.url
          ? doc.branding.logo.url
          : undefined;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          url: `https://${tenantSlug}.martes.app`,
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

export default async function TenantStorefrontPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;

  if (RESERVED_SLUGS.has(tenantSlug)) {
    notFound();
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

  let products: ProductItem[] = [];
  let categories: string[] = ['Todos'];
  let isDemo = true;

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
      const doc = tenantResult.docs[0] as Tenant;
      const branding = doc.branding as any;
      tenantConfig = {
        id: String(doc.id),
        name: doc.name || tenantConfig.name,
        slug: doc.slug || tenantSlug,
        theme: doc.theme || 'basic-banner',
        whatsappPhone: doc.whatsappPhone || '34600123456',
        welcomeMessage: branding?.welcomeMessage || undefined,
        primaryColor: branding?.primaryColor || undefined,
        exchangeRateVES: Number(branding?.exchangeRateVES) > 0 ? Number(branding?.exchangeRateVES) : liveRate,
        showVES: branding?.showVES ?? true,
        pickupConfig: doc.pickupConfig || undefined,
        paymentMethodsConfig: doc.paymentMethodsConfig || undefined,
        deliveryConfig: doc.deliveryConfig || undefined,
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
        isDemo = false;
        products = productsResult.docs.map((p) => {
          const prod = p as any;
          return {
            id: String(prod.id),
            sku: prod.sku || `SKU-${prod.id}`,
            title: prod.title,
            price: Number(prod.price) || 0,
            description: prod.description || '',
            category: prod.category && typeof prod.category === 'object'
              ? { id: String(prod.category.id), name: prod.category.name || 'General' }
              : undefined,
            stockStatus: (prod.stockStatus as 'in_stock' | 'out_of_stock') || 'in_stock',
            trackStock: Boolean(prod.trackStock),
            stockQuantity: prod.stockQuantity ? Number(prod.stockQuantity) : undefined,
            featured: Boolean(prod.featured),
            variants: Array.isArray(prod.variants)
              ? prod.variants.map((v: any) => ({
                  name: v.name,
                  sku: v.sku || undefined,
                  price: Number(v.price) || 0,
                  stockQuantity: v.stockQuantity ? Number(v.stockQuantity) : undefined,
                  stockStatus: v.stockStatus || undefined,
                }))
              : [],
            modifiers: Array.isArray(prod.modifiers)
              ? prod.modifiers.map((m: any) => ({
                  groupName: m.groupName,
                  options: Array.isArray(m.options)
                    ? m.options.map((opt: any) => ({
                        name: opt.name,
                        priceDelta: Number(opt.priceDelta) || 0,
                      }))
                    : [],
                }))
              : [],
            images: Array.isArray(prod.images)
              ? prod.images.map((img: any) => ({
                  url: (typeof img.image === 'object' && img.image?.url)
                    ? img.image.url
                    : typeof img.url === 'string'
                    ? img.url
                    : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
                }))
              : [],
          };
        });

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
      isDemo={isDemo}
    />
  );
}

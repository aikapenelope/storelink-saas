import React from 'react';
import type { Metadata } from 'next';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { unstable_cache } from 'next/cache';
import { resolveExchangeRateVES } from '@/lib/exchange-rate';
import type { Tenant } from '@/payload-types';
import {
  StorefrontClient,
  type ProductItem,
  type TenantConfig,
} from '@/components/storefront-client';

import { notFound } from 'next/navigation';
import { issueCheckoutNonce } from '@/lib/checkout-nonce';
import { getTenantBySlug } from '@/lib/tenants';

// ISR (patrón oficial Next.js 15): la tienda se revalida como máximo cada
// 5 minutos, y al instante tras cada mutación (checkout, sync-sheets,
// import-csv, tasa) vía revalidatePath/revalidateTag.
export const revalidate = 300;

// La tasa VES NO se resuelve en vivo por visita (gastaba fetch a Binance/
// dolarapi por cada render): se cachea 120s con tag `rate`; el endpoint de
// tasa manual la invalida con revalidateTag('rate').
const getRateVES = unstable_cache(
  async (tenantDoc: Tenant) => (await resolveExchangeRateVES(tenantDoc)).rate ?? undefined,
  ['exchange-rate'],
  { revalidate: 120, tags: ['rate'] }
);

const FALLBACK_IMAGE_URL =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

const RESERVED_SLUGS = new Set([  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'apple-touch-icon.png',
  'apple-touch-icon-precomposed.png',
  'manifest.json',
  'admin',
  'api',
  // Ruta estática de la página demo visual (nunca un tenant real)
  'demo',
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
    const doc = await getTenantBySlug(tenantSlug);

    if (doc) {
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
          // Modelo de URLs por ruta (sin subdominios): flow.martes.app/[slug]
          url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://flow.martes.app'}/${doc.slug || tenantSlug}`,
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

  let tenantConfig: TenantConfig;
  let products: ProductItem[] = [];
  let categories: string[] = ['Todos'];
  // Tenant real sin productos → cascarón vacío (products = [])

  try {
    const payload = await getPayload({ config });

    // La tienda no existe → 404 (sin página demo genérica)
    const doc = await getTenantBySlug(tenantSlug);
    if (!doc) {
      notFound();
    }

    const branding = doc.branding;

    // Tasa VES (jerarquía del producto): manual > Binance en vivo >
    // dólar paralelo > ninguna (no se muestran Bs) — cacheada 120s
    const exchangeRateVES = await getRateVES(doc);

    tenantConfig = {
      id: String(doc.id),
      name: doc.name || tenantSlug,
      slug: doc.slug || tenantSlug,
      theme: doc.theme || 'basic-banner',
      whatsappPhone: doc.whatsappPhone || '',
      welcomeMessage: branding?.welcomeMessage || undefined,
      primaryColor: branding?.primaryColor || undefined,
      exchangeRateVES: exchangeRateVES ?? undefined,
      showVES: branding?.showVES ?? true,
      pickupConfig: doc.pickupConfig || undefined,
      paymentMethodsConfig: doc.paymentMethodsConfig || undefined,
      deliveryConfig: doc.deliveryConfig || undefined,
    };

    // Fetch products for this tenant
    // Tope de catálogo: 500 (antes 100, que truncaba tiendas grandes en
    // silencio). El mapeo a ProductItem liviano ocurre aquí server-side y la
    // página es ISR, así que el costo extra queda fuera del request del
    // cliente. Pendiente (backlog): paginación real con hasNextPage.
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
      products = productsResult.docs.map((prod) => {
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
            ? prod.variants.map((v) => ({
                name: v.name,
                sku: v.sku || undefined,
                price: Number(v.price) || 0,
                stockQuantity: v.stockQuantity ? Number(v.stockQuantity) : undefined,
                stockStatus: v.stockStatus || undefined,
              }))
            : [],
          modifiers: Array.isArray(prod.modifiers)
            ? prod.modifiers.map((m) => ({
                groupName: m.groupName,
                options: Array.isArray(m.options)
                  ? m.options.map((opt) => ({
                      name: opt.name,
                      priceDelta: Number(opt.priceDelta) || 0,
                    }))
                  : [],
              }))
            : [],
          images: prod.imageUrl
            ? [{ url: prod.imageUrl }]
            : Array.isArray(prod.images) && prod.images.length > 0
            ? prod.images.map((img) => ({
                // La fila ProductImage solo trae la relación `image`
                // (poblada como Media con url, o id numérico sin resolver).
                url:
                  typeof img.image === 'object' && img.image?.url
                    ? img.image.url
                    : FALLBACK_IMAGE_URL,
              }))
            : [{ url: FALLBACK_IMAGE_URL }],
        };
      });

      // Dynamic categories from loaded products
      const catSet = new Set<string>(['Todos']);
      products.forEach((p) => {
        if (p.category?.name) catSet.add(p.category.name);
      });
      categories = Array.from(catSet);
    }
    // Tenant real sin productos: cascarón vacío (no catálogo demo)
  } catch (err) {
    console.error('Error fetching tenant products from Payload:', err);
    notFound();
  }

  return (
    <StorefrontClient
      tenant={tenantConfig!}
      products={products}
      categories={categories}
      checkoutNonce={issueCheckoutNonce(tenantConfig!.slug)}
    />
  );
}

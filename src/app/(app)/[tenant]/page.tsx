import React from 'react';
import type { Metadata } from 'next';
import { getPayload } from 'payload';
import config from '@payload-config';
import { unstable_cache } from 'next/cache';
import { resolveExchangeRateVES } from '@/lib/exchange-rate';
import { getCachedProducts } from '@/lib/storefront-cache';
import type { Tenant } from '@/payload-types';
import {
  StorefrontClient,
  type ProductItem,
  type TenantConfig,
} from '@/components/storefront-client';

import { notFound } from 'next/navigation';
import { issueCheckoutNonce } from '@/lib/checkout-nonce';
import { getTenantBySlug } from '@/lib/tenants';
import { DEFAULT_PRODUCT_IMAGE_URL, RESERVED_TENANT_SLUGS } from '@/lib/constants';

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: tenantSlug } = await params;
  if (RESERVED_TENANT_SLUGS.has(tenantSlug)) {
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

  if (RESERVED_TENANT_SLUGS.has(tenantSlug)) {
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
      // Filtrar solo los métodos de pago habilitados antes de serializar al HTML
      // público (ISR). El field-level access de Tenants.ts protege la lectura
      // por REST/admin, pero esta serialización RSC → client bypassa ese acceso.
      // No revelar cuentas bancarias/crypto de métodos disabled al visitante.
      paymentMethodsConfig: doc.paymentMethodsConfig
        ? {
            pagoMovil:   doc.paymentMethodsConfig.pagoMovil?.enabled   ? doc.paymentMethodsConfig.pagoMovil   : undefined,
            zelle:       doc.paymentMethodsConfig.zelle?.enabled       ? doc.paymentMethodsConfig.zelle       : undefined,
            binance:     doc.paymentMethodsConfig.binance?.enabled     ? doc.paymentMethodsConfig.binance     : undefined,
            zinli:       doc.paymentMethodsConfig.zinli?.enabled       ? doc.paymentMethodsConfig.zinli       : undefined,
            banescoPanama: doc.paymentMethodsConfig.banescoPanama?.enabled ? doc.paymentMethodsConfig.banescoPanama : undefined,
            cash:        doc.paymentMethodsConfig.cash?.enabled        ? doc.paymentMethodsConfig.cash        : undefined,
            pos:         doc.paymentMethodsConfig.pos?.enabled         ? doc.paymentMethodsConfig.pos         : undefined,
          }
        : undefined,
      deliveryConfig: doc.deliveryConfig || undefined,
    };

    // Fetch products for this tenant con caché distribuido Redis
    // Complementa el ISR de Next.js (300s) con caché adicional para reducir
    // carga BD en picos de tráfico. Fallback a memoria y BD si Redis no responde.
    const { products: productsDocs } = await getCachedProducts(payload, doc.id);

    if (productsDocs.length > 0) {
      products = productsDocs.map((prod) => {
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
          // Fase 1 (expand): imageUrls es el campo principal.
          // El fallback a images (upload legacy) se mantiene mientras haya
          // productos sin backfill — se eliminará en la migración contract (Fase 2).
          images:
            Array.isArray(prod.imageUrls) && prod.imageUrls.length > 0
              ? prod.imageUrls.map((url) => ({ url }))
              : [{ url: DEFAULT_PRODUCT_IMAGE_URL }],
        };
      });


      // Dynamic categories from loaded products
      const catSet = new Set<string>(['Todos']);
      products.forEach((p) => {
        if (p.category?.name) catSet.add(p.category.name);
      });
      categories = Array.from(catSet);
    }
  } catch (err: unknown) {
    const errorObject = err as { digest?: string; message?: string } | null;
    if (errorObject?.digest?.startsWith('NEXT_NOT_FOUND') || errorObject?.message === 'NEXT_NOT_FOUND') {
      throw err;
    }
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

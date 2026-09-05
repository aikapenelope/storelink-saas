import type { Metadata } from 'next';
import FlowLandingPage from '@/components/landing/landing-view';

/**
 * Auditoría 2026-09-04 (P2 SEO/arquitectura): la landing era un Client
 * Component completo ('use client' en página raíz), así que NO podía exportar
 * metadata y las dos páginas más importantes del dominio se indexaban sin OG
 * propio. El markup se movió a src/components/landing/landing-view.tsx y esta
 * página es un Server Component delgado con su metadata.
 */
export const metadata: Metadata = {
  title: 'Flow by Martes — Tu negocio vendiendo 24/7 en piloto automático | 0% Comisiones',
  description:
    'Crea la tienda online de tu negocio con catálogo interactivo, pedidos por WhatsApp y 0% comisiones. Agentes de IA oficiales y e-commerce de estándar internacional.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Flow by Martes — Tu negocio vendiendo 24/7 en piloto automático',
    description:
      'Catálogo interactivo, pedidos por WhatsApp y 0% comisiones para tu negocio.',
    url: '/',
    siteName: 'Flow by Martes',
    type: 'website',
  },
};

export default function Page() {
  return <FlowLandingPage />;
}

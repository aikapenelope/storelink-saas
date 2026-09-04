import type { Metadata } from 'next';
import TemplatesPage from '@/components/landing/templates-view';

/**
 * Auditoría 2026-09-04 (P2 SEO): página client movida a
 * src/components/landing/templates-view.tsx para poder exportar metadata
 * (mismo patrón que demo/page.tsx).
 */
export const metadata: Metadata = {
  title: 'Plantillas de Tienda | Flow by Martes',
  description:
    '9 plantillas profesionales de catálogo para tu negocio: gastronomía, moda, B2B, tech y más. Elige tu tema y empieza a vender por WhatsApp.',
  alternates: { canonical: '/templates' },
  openGraph: {
    title: 'Plantillas de Tienda | Flow by Martes',
    description: '9 plantillas de catálogo profesionales para vender por WhatsApp.',
    url: '/templates',
    type: 'website',
  },
};

export default function Page() {
  return <TemplatesPage />;
}

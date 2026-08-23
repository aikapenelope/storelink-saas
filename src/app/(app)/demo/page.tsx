import { StorefrontClient, type TenantConfig } from '@/components/storefront-client';

/**
 * Página DEMO VISUAL (solo UI / showcase de landing).
 * Renderiza el catálogo de muestra y los estilos de tienda (VERTICAL_PRODUCTS
 * + DemosMartesSwitcher) SIN ninguna conexión a Payload: no consulta tenants
 * ni productos de la BD, y el carrito está en modo preview (no envía pedidos).
 * Las tiendas reales viven en /[tenantSlug] y son tenants de Payload.
 */
export default function DemoPreviewPage() {
  const tenantConfig: TenantConfig = {
    id: 'demo-preview',
    name: 'Demo Flow Store',
    slug: 'demo',
    theme: 'basic-banner',
    whatsappPhone: '',
    welcomeMessage: 'Vista previa visual de las plantillas de tienda',
    exchangeRateVES: undefined,
    showVES: false,
  };

  return <StorefrontClient tenant={tenantConfig} products={[]} categories={['Todos']} isDemo />;
}
import { StorefrontClient, type TenantConfig } from '@/components/storefront-client';

/**
 * Página DEMO VISUAL (solo UI / showcase de landing).
 * Renderiza el catálogo de muestra y los estilos de tienda (VERTICAL_PRODUCTS
 * + DemosMartesSwitcher) SIN ninguna conexión a Payload: no consulta tenants
 * ni productos de la BD, y el carrito está en modo preview (no envía pedidos).
 * Las tiendas reales viven en /[tenantSlug] y son tenants de Payload.
 */
interface DemoPageProps {
  searchParams?: Promise<{ theme?: string }>;
}

export default async function DemoPreviewPage({ searchParams }: DemoPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const initialTheme = resolvedParams?.theme || 'food-delivery';

  const tenantConfig: TenantConfig = {
    id: 'demo-preview',
    name: 'Demo Flow Store',
    slug: 'demo',
    theme: initialTheme,
    whatsappPhone: '+584149189169',
    welcomeMessage: 'Vista previa interactiva de plantillas de tienda',
    exchangeRateVES: 68.5,
    showVES: true,
  };

  return <StorefrontClient tenant={tenantConfig} products={[]} categories={['Todos']} isDemo />;
}
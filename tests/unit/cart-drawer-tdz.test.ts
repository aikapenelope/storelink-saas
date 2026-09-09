import { describe, expect, it, vi } from 'vitest';
import React from 'react';

/**
 * PR 1.2 (plan sprints 2026-09-09): regresión del TDZ de `customer` en el
 * bloque de totales del CartDrawer (regresión #101 del refactor data-driven).
 *
 * `selectedZone` (línea de totales) lee `customer.municipality`, pero la
 * declaración `const [customer] = useState(...)` vivía ~450 líneas más abajo.
 * Con `deliveryConfig.zones.length >= 1` el `.find()` evalúa el callback
 * inmediatamente → ReferenceError en el primer render (SSR) → storefront del
 * tenant caído. Sin zonas, `?.` cortocircuitaba y el bug quedaba latente
 * (los 2 tenants activos no tienen zonas — por eso CI nunca lo vio).
 *
 * Test de render SIN dependencias nuevas: react-dom/server (SSR puro, ya en
 * el repo) es exactamente el contexto donde el TDZ reventaba. El archivo es
 * .ts (vitest solo incluye .test.ts): se usa createElement en lugar de JSX.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({}),
}));

const { renderToString } = await import('react-dom/server');
const { CartDrawer } = await import('../../src/components/cart-drawer');

const baseProps = {
  isOpen: true,
  onClose: () => {},
  items: [
    {
      id: 'p1',
      name: 'Producto Test',
      price: 10,
      quantity: 2,
    },
  ],
  storeName: 'Tienda Test',
  tenantSlug: 'test-tenant',
  checkoutNonce: 'nonce-test',
  pickupConfig: { locationAddress: 'Sede', schedule: 'L-V', estimatedTime: '20 min' },
  onUpdateQuantity: () => {},
  onClearCart: () => {},
};

describe('CartDrawer TDZ de customer (regresión #101 / PR 1.2)', () => {
  it('renderiza SIN throw con deliveryConfig.zones pobladas (el bug original)', () => {
    // Antes del fix: ReferenceError: Cannot access 'customer' before
    // initialization — el find() de selectedZone evaluaba el callback con
    // zonas presentes y customer aún no declarado.
    const props = {
      ...baseProps,
      deliveryConfig: {
        zones: [
          { name: 'Chacao', priceDelivery: 3 },
          { name: 'Baruta', priceDelivery: 4 },
        ],
        fixedPrice: 2,
        estimatedTime: '30-45 min',
      },
    };

    expect(() => renderToString(React.createElement(CartDrawer, props))).not.toThrow();
  });

  it('renderiza sin zonas igual que antes (path no afectado)', () => {
    const props = {
      ...baseProps,
      deliveryConfig: undefined,
    };

    expect(() => renderToString(React.createElement(CartDrawer, props))).not.toThrow();
  });

  it('el HTML renderizado incluye la primera zona como municipio inicial', () => {
    const props = {
      ...baseProps,
      deliveryConfig: {
        zones: [{ name: 'Chacao', priceDelivery: 3 }],
        fixedPrice: 2,
        estimatedTime: '30-45 min',
      },
    };

    const html = renderToString(React.createElement(CartDrawer, props));
    // La primera zona queda seleccionada por defecto en el <select> (Review
    // Devin #73): el option de Chacao aparece en el DOM renderizado.
    expect(html).toContain('Chacao');
  });
});

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ShoppingBag, Check } from 'lucide-react';
import { CartDrawer, type CartItem } from './cart-drawer';
import { DemosMartesSwitcher } from './demos-martes-switcher';
import { VERTICAL_PRESETS } from '@/data/theme-presets';
import { DEFAULT_PRODUCT_IMAGE_URL } from '@/lib/constants';

export interface ThemeProps {
  tenant: TenantConfig;
  products: ProductItem[];
  categories: string[];
  cartCount: number;
  cartAmount: number;
  cart: Array<{ id: string; quantity: number }>;
  activeTheme?: string;
  onSelectTheme?: (themeId: string) => void;
  onOpenCart: () => void;
  onOpenProductModal: (product: ProductItem) => void;
  onAddToCart: (product: ProductItem, quantity: number) => void;
}

const ThemeBasicBanner = dynamic<ThemeProps>(() =>
  import('./themes/theme-basic').then((m) => m.ThemeBasicBanner)
);
const ThemeFoodDelivery = dynamic<ThemeProps>(() =>
  import('./themes/theme-food').then((m) => m.ThemeFoodDelivery)
);
const ThemeFashionBoutique = dynamic<ThemeProps>(() =>
  import('./themes/theme-fashion').then((m) => m.ThemeFashionBoutique)
);
const ThemeMotoParts = dynamic<ThemeProps>(() =>
  import('./themes/theme-moto').then((m) => m.ThemeMotoParts)
);
const ThemeHardwareStore = dynamic<ThemeProps>(() =>
  import('./themes/theme-hardware').then((m) => m.ThemeHardwareStore)
);
const ThemeB2BMatrix = dynamic<ThemeProps>(() =>
  import('./themes/theme-b2b-matrix').then((m) => m.ThemeB2BMatrix)
);
const ThemeEditorial = dynamic<ThemeProps>(() =>
  import('./themes/theme-editorial').then((m) => m.ThemeEditorial)
);
const ThemeFluidPWA = dynamic<ThemeProps>(() =>
  import('./themes/theme-fluid-pwa').then((m) => m.ThemeFluidPWA)
);
const ThemeVercelCommerce = dynamic<ThemeProps>(() =>
  import('./themes/theme-vercel-commerce').then((m) => m.ThemeVercelCommerce)
);

const THEME_MAP: Record<string, React.ComponentType<ThemeProps>> = {
  'basic-banner': ThemeBasicBanner,
  'food-delivery': ThemeFoodDelivery,
  'fashion-boutique': ThemeFashionBoutique,
  'moto-parts': ThemeMotoParts,
  'hardware-store': ThemeHardwareStore,
  'b2b-matrix': ThemeB2BMatrix,
  'editorial': ThemeEditorial,
  'fluid-pwa': ThemeFluidPWA,
  'vercel-commerce': ThemeVercelCommerce,
};

export interface ProductVariant {
  name: string;
  sku?: string;
  price: number;
  stockQuantity?: number;
  stockStatus: 'in_stock' | 'out_of_stock';
}

export interface ProductModifierOption {
  name: string;
  priceDelta?: number;
}

export interface ProductModifierGroup {
  groupName: string;
  required?: boolean;
  options: ProductModifierOption[];
}

export interface ProductItem {
  id: string;
  sku: string;
  title: string;
  price: number;
  description?: string;
  category?: {
    id: string;
    name: string;
  };
  stockStatus: 'in_stock' | 'out_of_stock';
  trackStock?: boolean;
  stockQuantity?: number;
  featured?: boolean;
  images?: Array<{ url: string }>;
  variants?: ProductVariant[];
  modifiers?: ProductModifierGroup[];
  /** Nombres de las opciones de modificadores seleccionadas (las valida el servidor) */
  selectedModifiers?: string[];
}

export interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  theme?: 'basic-banner' | 'food-delivery' | 'fashion-boutique' | 'moto-parts' | 'hardware-store' | string;
  whatsappPhone: string;
  currency?: string;
  showVES?: boolean;
  exchangeRateVES?: number;
  primaryColor?: string;
  welcomeMessage?: string;
  pickupConfig?: {
    enabled?: boolean | null;
    locationAddress?: string | null;
    schedule?: string | null;
    estimatedTime?: string | null;
    instructions?: string | null;
  };
  paymentMethodsConfig?: {
    pagoMovil?: {
      enabled?: boolean | null;
      bank?: string | null;
      phone?: string | null;
      idDoc?: string | null;
      accountHolder?: string | null;
    };
    zelle?: {
      enabled?: boolean | null;
      email?: string | null;
      accountHolder?: string | null;
    };
    binance?: {
      enabled?: boolean | null;
      payId?: string | null;
      nickname?: string | null;
    };
    zinli?: {
      enabled?: boolean | null;
      email?: string | null;
      accountHolder?: string | null;
    };
    banescoPanama?: {
      enabled?: boolean | null;
      accountNumber?: string | null;
      accountHolder?: string | null;
      accountType?: string | null;
    };
    cash?: {
      enabled?: boolean | null;
      instructions?: string | null;
    };
    pos?: {
      enabled?: boolean | null;
      instructions?: string | null;
    };
  };
  deliveryConfig?: {
    fixedPrice?: number | null;
    estimatedTime?: string | null;
    zones?: Array<{
      id?: string | null;
      name: string;
      priceDelivery?: number | null;
      estimatedTime?: string | null;
    }> | null;
  };
}

interface StorefrontClientProps {
  tenant: TenantConfig;
  products: ProductItem[];
  categories: string[];
  isDemo?: boolean;
  /** Nonce anti-abuso emitido por [tenant]/page.tsx; en /demo no hay checkout real */
  checkoutNonce?: string;
}

// Preset datasets imported from @/data/theme-presets
const VERTICAL_PRODUCTS = VERTICAL_PRESETS;

export function StorefrontClient({
  tenant,
  products,
  categories,
  isDemo = false,
  checkoutNonce,
}: StorefrontClientProps) {
  const storageKey = `flow_cart_${tenant.slug}`;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Hidratación segura SSR desde localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
    } catch {
      // Silencioso ante errores de parse
    } finally {
      setHasHydrated(true);
    }
  }, [storageKey]);

  // Persistencia reactiva del carrito
  useEffect(() => {
    if (!hasHydrated || typeof window === 'undefined') return;
    try {
      if (cart.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(cart));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // Silencioso ante cuotas de almacenamiento
    }
  }, [cart, hasHydrated, storageKey]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Active theme (defaults to tenant.theme, allows live preview toggle)
  const [activeTheme, setActiveTheme] = useState<string>(tenant.theme || 'basic-banner');

  // Modal variant & modifier selection state
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, ProductModifierOption>>({});

  const handleOpenProductModal = (product: ProductItem) => {
    setSelectedProduct(product);
    setSelectedVariant(product.variants && product.variants.length > 0 ? product.variants[0] : null);
    setSelectedModifiers({});
  };

  const currentModalPrice = useMemo(() => {
    if (!selectedProduct) return 0;
    let base = selectedVariant ? selectedVariant.price : selectedProduct.price;
    Object.values(selectedModifiers).forEach((mod) => {
      if (mod.priceDelta) base += mod.priceDelta;
    });
    return base;
  }, [selectedProduct, selectedVariant, selectedModifiers]);

  const handleAddToCart = (product: ProductItem, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        return prev.filter((item) => item.id !== product.id);
      }
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) => (item.id === product.id ? { ...item, quantity } : item));
      }
      return [
        ...prev,
        {
          ...product,
          quantity,
        },
      ];
    });
  };

  const handleAddCustomizedToCart = () => {
    if (!selectedProduct) return;

    const modLabels = Object.values(selectedModifiers).map((m) => m.name);
    const variantLabel = selectedVariant ? selectedVariant.name : '';
    const customizations = [variantLabel, ...modLabels].filter(Boolean).join(', ');

    const finalTitle = customizations
      ? `${selectedProduct.title} (${customizations})`
      : selectedProduct.title;

    const finalSku = selectedVariant?.sku || selectedProduct.sku;
    const finalId = `${selectedProduct.id}-${customizations.replace(/\s+/g, '-').toLowerCase() || 'base'}`;

    const customizedItem: ProductItem = {
      ...selectedProduct,
      id: finalId,
      sku: finalSku,
      title: finalTitle,
      price: currentModalPrice,
      // El servidor valida y resuelve el delta de cada opción (precios oficiales)
      selectedModifiers: Object.values(selectedModifiers).map((m) => m.name),
    };

    const existing = cart.find((item) => item.id === finalId);
    const targetQty = (existing ? existing.quantity : 0) + 1;

    handleAddToCart(customizedItem, targetQty);
    setSelectedProduct(null);
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        return prev.filter((item) => item.id !== productId);
      }
      return prev.map((item) => (item.id === productId ? { ...item, quantity } : item));
    });
  };

  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalCartAmount = cart.reduce((acc, item) => acc + item.quantity * item.price, 0);

  // Real database tenant resolution
  const isRealStore = !isDemo;
  const currentVertical = VERTICAL_PRODUCTS[activeTheme] || VERTICAL_PRODUCTS['basic-banner'];

  const activeProducts = isRealStore ? products : currentVertical.items;
  const activeCategories = isRealStore ? categories : currentVertical.categories;

  const activeTenantConfig: TenantConfig = {
    ...tenant,
    name: isRealStore ? tenant.name : currentVertical.name,
    welcomeMessage: isRealStore ? tenant.welcomeMessage : currentVertical.welcome,
    exchangeRateVES: tenant.exchangeRateVES,
    showVES: tenant.showVES ?? true,
  };

  const themeProps = {
    tenant: activeTenantConfig,
    products: activeProducts,
    categories: activeCategories,
    cartCount: totalCartCount,
    cartAmount: totalCartAmount,
    cart,
    activeTheme,
    onSelectTheme: (themeId: string) => setActiveTheme(themeId),
    onOpenCart: () => setIsCartOpen(true),
    onOpenProductModal: handleOpenProductModal,
    onAddToCart: handleAddToCart,
  };

  const ActiveThemeComponent = THEME_MAP[activeTheme] || ThemeBasicBanner;

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden">
      {/* Render Active Theme View from 9 presets dynamically */}
      <ActiveThemeComponent {...themeProps} />

      {/* Shared Interactive Product Customizer Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 pb-16 sm:p-4 sm:pb-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-white text-slate-900 rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[80vh] sm:max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-6 duration-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image Banner */}
            <div className="relative h-56 bg-slate-100 flex-shrink-0">
              <img
                src={
                  selectedProduct.images?.[0]?.url ||
                  DEFAULT_PRODUCT_IMAGE_URL
                }
                alt={selectedProduct.title}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  SKU: {selectedVariant?.sku || selectedProduct.sku}
                </span>
                <span className="text-xl font-black text-emerald-700">
                  ${currentModalPrice.toFixed(2)}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedProduct.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed mt-1">
                  {selectedProduct.description || 'Sin descripción detallada.'}
                </p>
              </div>

              {/* Variants Section */}
              {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Selecciona una opción / Tamaño:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedProduct.variants.map((v) => {
                      const isSelected = selectedVariant?.name === v.name;
                      return (
                        <button
                          key={v.name}
                          onClick={() => setSelectedVariant(v)}
                          className={`p-2.5 rounded-xl border text-left flex justify-between items-center transition ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 ring-1 ring-emerald-600'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold">{v.name}</p>
                            <p className="text-[11px] text-slate-500">${v.price.toFixed(2)}</p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modifiers Section */}
              {selectedProduct.modifiers && selectedProduct.modifiers.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  {selectedProduct.modifiers.map((group) => (
                    <div key={group.groupName} className="space-y-2">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                        {group.groupName}:
                      </label>
                      <div className="space-y-1.5">
                        {group.options.map((opt) => {
                          const isSelected = selectedModifiers[group.groupName]?.name === opt.name;
                          return (
                            <button
                              key={opt.name}
                              onClick={() => {
                                setSelectedModifiers((prev) => {
                                  if (isSelected) {
                                    const next = { ...prev };
                                    delete next[group.groupName];
                                    return next;
                                  }
                                  return { ...prev, [group.groupName]: opt };
                                });
                              }}
                              className={`w-full p-2.5 rounded-xl border text-left flex justify-between items-center transition ${
                                isSelected
                                  ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950'
                                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span className="text-xs font-medium">{opt.name}</span>
                              <div className="flex items-center gap-2">
                                {opt.priceDelta ? (
                                  <span className="text-xs font-bold text-emerald-700">
                                    +${opt.priceDelta.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">Gratis</span>
                                )}
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                    isSelected
                                      ? 'border-emerald-600 bg-emerald-600 text-white'
                                      : 'border-slate-300'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3" />}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add to Cart CTA */}
              <div className="pt-3 pb-3 sticky bottom-0 bg-white border-t border-slate-100 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
                <button
                  onClick={handleAddCustomizedToCart}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Añadir al Carrito (${currentModalPrice.toFixed(2)})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart & Checkout Sliding Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        currency={activeTenantConfig.currency || 'USD'}
        exchangeRateVES={activeTenantConfig.exchangeRateVES}
        showVES={activeTenantConfig.showVES}
        tenantSlug={tenant.slug}
        storeName={activeTenantConfig.name}
        whatsappPhone={tenant.whatsappPhone}
        preview={isDemo}
        checkoutNonce={checkoutNonce}
        pickupConfig={tenant.pickupConfig}
        paymentMethodsConfig={tenant.paymentMethodsConfig}
        deliveryConfig={tenant.deliveryConfig}
        onUpdateQuantity={handleUpdateQuantity}
        onClearCart={() => setCart([])}
      />

      {/* PWA Fixed Bottom Store Demo Switcher Bar (only on marketing/demo mode) */}
      {isDemo && (
        <DemosMartesSwitcher
          activeTheme={activeTheme}
          onSelectTheme={setActiveTheme}
        />
      )}
    </div>
  );
}

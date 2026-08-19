'use client';

import React, { useState, useMemo } from 'react';
import { ShoppingBag, Check, Layers } from 'lucide-react';
import { CartDrawer, type CartItem } from './cart-drawer';
import { ThemeFluidPWA } from './themes/theme-fluid-pwa';
import { ThemeVercelCommerce } from './themes/theme-vercel-commerce';
import { ThemeEditorial } from './themes/theme-editorial';
import { ThemeB2BMatrix } from './themes/theme-b2b-matrix';

export interface ProductVariant {
  name: string;
  sku?: string;
  price: number;
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
}

export interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  theme?: 'fluid-pwa' | 'vercel-commerce' | 'editorial-lookbook' | 'b2b-matrix' | string;
  whatsappPhone: string;
  currency?: string;
  primaryColor?: string;
  welcomeMessage?: string;
  trelloConfig?: {
    apiKey?: string;
    token?: string;
    listId?: string;
  };
}

interface StorefrontClientProps {
  tenant: TenantConfig;
  products: ProductItem[];
  categories: string[];
}

export function StorefrontClient({
  tenant,
  products,
  categories,
}: StorefrontClientProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Active theme (defaults to tenant.theme, allows live preview toggle)
  const [activeTheme, setActiveTheme] = useState<string>(tenant.theme || 'fluid-pwa');

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
    };

    handleAddToCart(customizedItem, 1);
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

  const themeProps = {
    tenant,
    products,
    categories,
    cartCount: totalCartCount,
    cartAmount: totalCartAmount,
    cart,
    onOpenCart: () => setIsCartOpen(true),
    onOpenProductModal: handleOpenProductModal,
    onAddToCart: handleAddToCart,
  };

  return (
    <div className="relative min-h-screen">
      {/* Live Interactive Theme Switcher Bar (Top Floating Tag) */}
      <div className="fixed top-2 right-2 z-50 flex items-center gap-1 bg-black/80 backdrop-blur-md border border-white/20 p-1 rounded-full shadow-2xl text-[11px] text-white">
        <span className="px-2 py-0.5 font-bold flex items-center gap-1 text-slate-300">
          <Layers className="w-3 h-3" /> Tema:
        </span>
        <button
          onClick={() => setActiveTheme('fluid-pwa')}
          className={`px-2.5 py-1 rounded-full font-medium transition ${
            activeTheme === 'fluid-pwa' ? 'bg-emerald-600 text-white font-bold' : 'hover:bg-white/10'
          }`}
        >
          PWA
        </button>
        <button
          onClick={() => setActiveTheme('vercel-commerce')}
          className={`px-2.5 py-1 rounded-full font-medium transition ${
            activeTheme === 'vercel-commerce' ? 'bg-white text-black font-bold' : 'hover:bg-white/10'
          }`}
        >
          Vercel
        </button>
        <button
          onClick={() => setActiveTheme('editorial-lookbook')}
          className={`px-2.5 py-1 rounded-full font-medium transition ${
            activeTheme === 'editorial-lookbook' ? 'bg-[#ebdcd0] text-[#2d2825] font-bold' : 'hover:bg-white/10'
          }`}
        >
          Boutique
        </button>
        <button
          onClick={() => setActiveTheme('b2b-matrix')}
          className={`px-2.5 py-1 rounded-full font-medium transition ${
            activeTheme === 'b2b-matrix' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-white/10'
          }`}
        >
          B2B
        </button>
      </div>

      {/* Render Active Theme View */}
      {activeTheme === 'vercel-commerce' && <ThemeVercelCommerce {...themeProps} />}
      {activeTheme === 'editorial-lookbook' && <ThemeEditorial {...themeProps} />}
      {activeTheme === 'b2b-matrix' && <ThemeB2BMatrix {...themeProps} />}
      {activeTheme === 'fluid-pwa' && <ThemeFluidPWA {...themeProps} />}

      {/* Interactive Product Customizer Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-white text-slate-900 rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-6 duration-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image Banner */}
            <div className="relative h-56 bg-slate-100 flex-shrink-0">
              <img
                src={
                  selectedProduct.images?.[0]?.url ||
                  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'
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
              <div className="pt-3 sticky bottom-0 bg-white">
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
        tenantSlug={tenant.slug}
        storeName={tenant.name}
        whatsappPhone={tenant.whatsappPhone}
        trelloConfig={tenant.trelloConfig}
        onUpdateQuantity={handleUpdateQuantity}
        onClearCart={() => setCart([])}
      />
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, Plus, Minus, Info, Check, Sparkles } from 'lucide-react';
import { CartDrawer, type CartItem } from './cart-drawer';

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
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

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

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === 'Todos' || product.category?.name === selectedCategory;
      const matchesSearch =
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description &&
          product.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {tenant.name}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {tenant.welcomeMessage || 'Catálogo interactivo con pedidos por WhatsApp'}
            </p>
          </div>
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2.5 bg-emerald-50 text-emerald-700 rounded-full hover:bg-emerald-100 transition-colors"
            aria-label="Ver carrito"
          >
            <ShoppingBag className="w-5 h-5" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-600 text-white font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-bounce">
                {totalCartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar productos o código SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm"
          />
        </div>

        {/* Category Pills Bar */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shadow-sm ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-slate-900/10'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-slate-300">
              <p className="text-slate-400 text-sm">No se encontraron productos disponibles.</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const inCart = cart.find((item) => item.id === product.id);
              const qty = inCart ? inCart.quantity : 0;
              const isOutOfStock = product.stockStatus === 'out_of_stock';
              const hasOptions = (product.variants && product.variants.length > 0) || (product.modifiers && product.modifiers.length > 0);
              const imageUrl =
                product.images?.[0]?.url ||
                'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-sm flex gap-3.5 items-center transition hover:shadow-md"
                >
                  {/* Product Image */}
                  <div
                    onClick={() => handleOpenProductModal(product)}
                    className="relative w-24 h-24 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 cursor-pointer group"
                  >
                    <img
                      src={imageUrl}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Info className="w-5 h-5 text-white drop-shadow" />
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {product.sku}
                      </span>
                      {product.featured && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" /> Destacado
                        </span>
                      )}
                    </div>
                    <h2
                      onClick={() => handleOpenProductModal(product)}
                      className="font-bold text-slate-800 text-sm leading-tight truncate cursor-pointer hover:text-emerald-600 transition"
                    >
                      {product.title}
                    </h2>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                      {product.description}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-emerald-700 font-extrabold text-base">
                        {hasOptions && <span className="text-xs font-normal text-slate-500 mr-1">Desde</span>}
                        ${product.price.toFixed(2)}
                      </span>

                      {/* Stock or Cart Action */}
                      {isOutOfStock ? (
                        <span className="text-[11px] font-semibold text-rose-500 bg-rose-50 px-2 py-1 rounded-md">
                          Agotado
                        </span>
                      ) : hasOptions ? (
                        <button
                          onClick={() => handleOpenProductModal(product)}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm active:scale-95 transition"
                        >
                          Opciones
                        </button>
                      ) : qty > 0 ? (
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-1.5 py-1">
                          <button
                            onClick={() => handleAddToCart(product, qty - 1)}
                            className="w-6 h-6 flex items-center justify-center text-emerald-800 hover:bg-emerald-200/60 rounded"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-black text-emerald-900 w-4 text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() => handleAddToCart(product, qty + 1)}
                            className="w-6 h-6 flex items-center justify-center text-emerald-800 hover:bg-emerald-200/60 rounded"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddToCart(product, 1)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-sm active:scale-95 transition"
                        >
                          Añadir
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Fixed Floating Bottom Cart Bar */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-4 left-0 right-0 z-40 max-w-md mx-auto px-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between border border-slate-800 hover:bg-slate-800 active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3">
              <span className="bg-emerald-500 text-slate-950 text-xs font-black px-2.5 py-1 rounded-full">
                {totalCartCount} {totalCartCount === 1 ? 'ítem' : 'ítems'}
              </span>
              <span className="font-semibold text-sm">Ver Pedido</span>
            </div>
            <span className="text-base font-black text-emerald-400">
              ${totalCartAmount.toFixed(2)}
            </span>
          </button>
        </div>
      )}

      {/* Interactive Product Customizer Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-6 duration-200 flex flex-col"
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

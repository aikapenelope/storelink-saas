'use client';

import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, Plus, Minus, Flame, Clock, Star, Sparkles, ChevronRight } from 'lucide-react';
import { DemosMartesSwitcher } from '@/components/demos-martes-switcher';
import { type ProductItem, type TenantConfig } from '@/components/storefront-client';

interface ThemeProps {
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

export function ThemeFoodDelivery({
  tenant,
  products,
  categories,
  cartCount,
  cartAmount,
  cart,
  activeTheme = 'food-delivery',
  onSelectTheme = () => {},
  onOpenCart,
  onOpenProductModal,
  onAddToCart,
}: ThemeProps) {
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  const exchangeRate = tenant.exchangeRateVES || 0;
  const showVES = (tenant.showVES ?? false) && exchangeRate > 0;

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
    <div className="min-h-screen bg-[#fcfbfa] text-slate-900 pb-36 font-sans w-full max-w-full overflow-x-hidden">
      {/* 0. Live Binance Exchange Rate Top Strip */}
      {showVES && (
        <div className="bg-slate-950 text-slate-200 text-xs py-1.5 px-4 text-center font-bold flex items-center justify-center gap-2 border-b border-slate-800">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span className="text-amber-400 font-extrabold">Tasa Oficial Binance P2P:</span>
          <span className="font-mono bg-slate-800 text-white px-2 py-0.5 rounded text-[11px]">
            {exchangeRate.toFixed(2)} Bs/$
          </span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">• Actualizado en tiempo real</span>
        </div>
      )}

      {/* 1. Dynamic Top Banner */}
      <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 text-white text-xs py-2 px-4 text-center font-bold flex items-center justify-center gap-2 shadow-inner">
        <Sparkles className="w-3.5 h-3.5 animate-spin" />
        <span>🔥 ¡Pide hoy por WhatsApp y recibe envío prioritario en tu zona!</span>
      </div>

      {/* 2. Glassmorphic App Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-orange-100 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xl sm:text-2xl shadow-lg shadow-orange-500/30 transform hover:rotate-3 transition flex-shrink-0">
              🍔
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900 truncate">
                  {tenant.name}
                </h1>
                <span className="bg-emerald-100 text-emerald-800 text-[9px] sm:text-[10px] font-black px-2 sm:px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> ABIERTO
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-500 font-semibold mt-0.5">
                <span className="flex items-center gap-1 text-amber-600 text-[11px] sm:text-xs">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> 4.9 (140+)
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-600 text-[11px] sm:text-xs">
                  <Clock className="w-3.5 h-3.5 text-orange-500" /> 20-30 min
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenCart}
            className="relative px-3.5 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl transition-all flex items-center gap-2 font-black text-xs shadow-lg shadow-orange-500/25 active:scale-95 flex-shrink-0"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline uppercase tracking-wider">Ver Bandeja</span>
            {cartCount > 0 && (
              <span className="bg-white text-orange-600 text-xs px-2 py-0.5 rounded-full font-black shadow-xs">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 3. Hero Promo Spotlight Card */}
      <section className="max-w-6xl mx-auto px-4 pt-6">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-orange-950 text-white p-6 sm:p-8 shadow-xl border border-orange-900/30 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left z-10">
            <span className="bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full inline-block">
              Especial de la Casa
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              Combos Smash Burger & Pizzas Napolitanas
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm max-w-lg">
              Ingredientes 100% artesanales, carnes maduradas y pan brioche horneado a diario.
            </p>
          </div>
          <div className="flex items-center gap-3 z-10">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 text-center">
              <span className="block text-2xl font-black text-amber-400">100%</span>
              <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider">Artesanal</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 text-center">
              <span className="block text-2xl font-black text-emerald-400">0$</span>
              <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider">Costo Envío</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Search & Filter Bar */}
      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
            <input
              type="text"
              placeholder="Buscar platillos, ingredientes, bebidas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-orange-100 rounded-2xl text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-xs font-medium"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all shadow-xs ${
                  selectedCategory === cat
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25 scale-105'
                    : 'bg-white text-slate-700 border border-slate-200/80 hover:bg-orange-50/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 5. Food Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-dashed border-orange-200">
            <p className="text-slate-400 text-sm font-semibold">No encontramos platillos disponibles en esta categoría.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProducts.map((product) => {
              const inCart = cart.find((item) => item.id === product.id);
              const qty = inCart ? inCart.quantity : 0;
              const isOutOfStock = product.stockStatus === 'out_of_stock';
              const hasOptions =
                (product.variants && product.variants.length > 0) ||
                (product.modifiers && product.modifiers.length > 0);
              const imageUrl =
                product.images?.[0]?.url ||
                'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80';

              const priceInVES = product.price * exchangeRate;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-3xl p-4 border border-orange-100 shadow-sm hover:shadow-xl hover:border-orange-300 transition-all duration-300 flex flex-col justify-between group"
                >
                  <div>
                    {/* Image Box */}
                    <div
                      onClick={() => onOpenProductModal(product)}
                      className="relative h-48 w-full rounded-2xl overflow-hidden bg-slate-100 cursor-pointer"
                    >
                      <img
                        src={imageUrl}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition" />
                      
                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex gap-1.5">
                        {product.featured && (
                          <span className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                            <Flame className="w-3 h-3 fill-white" /> POPULAR
                          </span>
                        )}
                        <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-full">
                          {product.sku}
                        </span>
                      </div>

                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                          <span className="bg-rose-600 text-white text-xs font-black uppercase px-4 py-1.5 rounded-full shadow-lg">
                            Agotado
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content Details */}
                    <div className="pt-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">
                          {product.category?.name || 'Menú Principal'}
                        </span>
                        <div className="flex items-center gap-1 text-amber-500 text-xs font-black">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> 4.9
                        </div>
                      </div>

                      <h3
                        onClick={() => onOpenProductModal(product)}
                        className="font-black text-slate-900 text-base leading-tight group-hover:text-orange-600 transition cursor-pointer line-clamp-1"
                      >
                        {product.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {product.description || 'Elaborado con ingredientes frescos de primera calidad.'}
                      </p>
                    </div>
                  </div>

                  {/* Pricing & Add to Cart */}
                  <div className="mt-4 pt-3 border-t border-orange-50 flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-1">
                        {hasOptions && <span className="text-[10px] text-slate-400">Desde</span>}
                        <span className="text-xl font-black text-slate-950">
                          ${product.price.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">USD</span>
                      </div>
                      {showVES && (
                        <span className="text-[11px] font-mono font-bold text-slate-500 block">
                          Bs. {priceInVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>

                    <div>
                      {isOutOfStock ? (
                        <span className="text-xs text-slate-400 font-bold">No disponible</span>
                      ) : hasOptions ? (
                        <button
                          onClick={() => onOpenProductModal(product)}
                          className="bg-slate-950 hover:bg-orange-600 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1"
                        >
                          <span>Personalizar</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : qty > 0 ? (
                        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-2.5 py-1.5 shadow-inner">
                          <button
                            onClick={() => onAddToCart(product, qty - 1)}
                            className="w-6 h-6 flex items-center justify-center text-orange-900 hover:bg-orange-200/60 rounded-lg transition"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-black text-orange-950 w-5 text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() => onAddToCart(product, qty + 1)}
                            className="w-6 h-6 flex items-center justify-center text-orange-900 hover:bg-orange-200/60 rounded-lg transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onAddToCart(product, 1)}
                          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md shadow-orange-500/20 active:scale-95 transition flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" /> Añadir
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 6. Premium Floating WhatsApp Checkout Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-16 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={onOpenCart}
            className="w-full bg-gradient-to-r from-slate-950 via-slate-900 to-orange-950 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-orange-500/30 hover:shadow-orange-500/20 active:scale-[0.99] transition group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="bg-orange-500 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-sm flex-shrink-0">
                {cartCount}
              </span>
              <div className="text-left min-w-0">
                <span className="font-black text-xs sm:text-sm block truncate">Completar Pedido</span>
                <span className="text-[9px] sm:text-[10px] text-orange-300 truncate block">Al WhatsApp del restaurante</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-sm sm:text-lg font-black text-amber-400 font-mono">${cartAmount.toFixed(2)}</span>
                <ChevronRight className="w-4 h-4 text-orange-400 group-hover:translate-x-1 transition" />
              </div>
              {showVES && (
                <span className="text-[9px] sm:text-[10px] text-orange-200 block font-mono">
                  Bs. {(cartAmount * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

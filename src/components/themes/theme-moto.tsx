'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { ShoppingBag, Search, Wrench, ShieldCheck, Gauge, Plus, Minus, Zap, CheckCircle2, ChevronRight } from 'lucide-react';
import { type ProductItem, type TenantConfig } from '@/components/storefront-client';
import { DEFAULT_PRODUCT_IMAGE_URL } from '@/lib/constants';

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

export function ThemeMotoParts({
  tenant,
  products,
  categories,
  cartCount,
  cartAmount,
  cart,
  onOpenCart,
  onOpenProductModal,
  onAddToCart,
}: ThemeProps) {
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBikeBrand, setSelectedBikeBrand] = useState('TODAS');

  const exchangeRate = tenant.exchangeRateVES || 0;
  const showVES = (tenant.showVES ?? true) && exchangeRate > 0;

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
    <div className="min-h-screen bg-[#0a0c10] text-neutral-100 selection:bg-amber-400 selection:text-black pb-36 font-sans w-full max-w-full overflow-x-hidden">
      {/* 1. Pro Automotive Status Bar */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black text-xs py-1.5 px-4 text-center font-black flex items-center justify-center gap-3 tracking-wide shadow-md">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 fill-black" />
          <span>REPUESTOS Y ACCESORIOS DE MOTO CON ENVÍO DIRECTO</span>
        </div>
        {showVES && (
          <span className="bg-black text-amber-400 px-2.5 py-0.5 rounded-full font-mono text-[10px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            TASA BINANCE P2P: {exchangeRate.toFixed(2)} Bs/$
          </span>
        )}
      </div>

      {/* 2. Moto Pro Header */}
      <header className="sticky top-0 z-40 bg-[#0e1217]/90 backdrop-blur-xl border-b border-neutral-800 shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-400 text-black flex items-center justify-center font-black text-lg sm:text-xl shadow-lg shadow-amber-400/20 border border-amber-300 transform hover:scale-105 transition flex-shrink-0">
              <Gauge className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base sm:text-xl tracking-tight text-white truncate">{tenant.name}</h1>
                <span className="bg-amber-400/10 text-amber-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-amber-400/30 flex-shrink-0">
                  OEM
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono hidden md:flex items-center gap-2 mt-0.5">
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Stock en Almacén
                </span>
                <span>•</span>
                <span>Cilindros, Frenos, Cadenas y Lubricantes</span>
              </p>
            </div>
          </div>

          <button
            onClick={onOpenCart}
            className="h-10 sm:h-12 px-3 sm:px-5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black font-black text-xs rounded-2xl transition flex items-center gap-2 shadow-xl shadow-amber-400/20 active:scale-95 uppercase tracking-wider flex-shrink-0"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Mi Pedido</span>
            <span className="bg-black text-amber-400 text-xs font-mono px-2 py-0.5 rounded-lg font-black">
              ${cartAmount.toFixed(2)}
            </span>
          </button>
        </div>
      </header>

      {/* 3. Interactive Bike Brand Selector Strip */}
      <section className="max-w-6xl mx-auto px-4 pt-6">
        <div className="bg-[#141922] border border-neutral-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 w-full min-w-0 max-w-full overflow-hidden">
          <div className="flex items-center gap-3 text-neutral-300">
            <Wrench className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-xs font-mono font-bold uppercase text-white block">Selector de Compatibilidad:</span>
              <span className="text-[11px] text-neutral-400 font-mono">Filtra repuestos para tu motocicleta</span>
            </div>
          </div>

          {/* Bike Brands */}
          <div className="w-full md:w-auto min-w-0 max-w-full overflow-x-auto no-scrollbar py-1">
            <div className="flex gap-2 flex-nowrap">
              {['TODAS', 'BERA', 'EMPIRE', 'YAMAHA', 'HONDA', 'SUZUKI'].map((brand) => (
                <button
                  key={brand}
                  onClick={() => setSelectedBikeBrand(brand)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-black uppercase transition whitespace-nowrap flex-shrink-0 ${
                    selectedBikeBrand === brand
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                      : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Search & Category Filter */}
      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6 w-full min-w-0 max-w-full overflow-hidden">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 w-full min-w-0 max-w-full overflow-hidden">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
            <input
              type="text"
              placeholder="Buscar por pieza, modelo (CG150, DT, SBR, Keeway)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-[#141922] border border-neutral-800 rounded-2xl text-xs sm:text-sm placeholder:text-neutral-500 text-white focus:outline-none focus:border-amber-400 font-mono shadow-inner"
            />
          </div>

          <div className="w-full md:w-auto min-w-0 max-w-full overflow-x-auto no-scrollbar py-1">
            <div className="flex gap-2 flex-nowrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-mono uppercase tracking-wider font-bold transition whitespace-nowrap flex-shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20'
                      : 'bg-[#141922] text-neutral-400 border border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 5. Industrial Moto Parts Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-24 text-center border border-neutral-800 rounded-3xl bg-[#141922]">
            <p className="text-neutral-500 text-sm font-mono">No se encontraron repuestos con este criterio de búsqueda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProducts.map((product) => {
              const inCart = cart.find((item) => item.id === product.id);
              const qty = inCart ? inCart.quantity : 0;
              const isOutOfStock = product.stockStatus === 'out_of_stock';
              const hasOptions =
                (product.variants && product.variants.length > 0) ||
                (product.modifiers && product.modifiers.length > 0);
              const imageUrl =
                product.images?.[0]?.url ||
                DEFAULT_PRODUCT_IMAGE_URL;

              const priceInVES = product.price * exchangeRate;

              return (
                <div
                  key={product.id}
                  className="bg-[#12161f] border border-neutral-800 hover:border-amber-400/60 rounded-3xl p-4 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-amber-400/5 group"
                >
                  <div>
                    {/* Image & Badges */}
                    <div
                      onClick={() => onOpenProductModal(product)}
                      className="relative aspect-video w-full rounded-2xl overflow-hidden bg-neutral-950 cursor-pointer"
                    >
                      <Image
                        src={imageUrl}
                        alt={product.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-3 left-3 bg-black/85 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-mono font-black text-amber-400 border border-neutral-800 shadow-md">
                        OEM: {product.sku}
                      </div>
                      
                      {isOutOfStock ? (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                          <span className="text-rose-400 font-mono text-xs font-black uppercase px-4 py-1.5 rounded-lg border border-rose-800 bg-rose-950/90 shadow-lg">
                            Sin Stock
                          </span>
                        </div>
                      ) : (
                        <div className="absolute bottom-3 right-3 bg-emerald-950/90 text-emerald-400 text-[10px] font-mono font-black px-2.5 py-1 rounded-lg border border-emerald-700/60 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> 100% Genuino
                        </div>
                      )}
                    </div>

                    {/* Information */}
                    <div className="pt-4 space-y-1.5">
                      <span className="text-[10px] uppercase font-mono text-amber-400 tracking-wider block font-bold">
                        {product.category?.name || 'Repuesto Automotriz'}
                      </span>
                      <h3
                        onClick={() => onOpenProductModal(product)}
                        className="font-black text-base text-white group-hover:text-amber-400 transition cursor-pointer line-clamp-1"
                      >
                        {product.title}
                      </h3>
                      <p className="text-xs text-neutral-400 line-clamp-2 font-mono leading-relaxed">
                        {product.description || 'Repuesto de alto rendimiento probado en banco.'}
                      </p>
                    </div>
                  </div>

                  {/* Pricing & Add to Cart */}
                  <div className="mt-5 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-amber-400 font-mono">
                          ${product.price.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">USD</span>
                      </div>
                      {showVES && (
                        <span className="text-[11px] font-mono font-bold text-neutral-400 block">
                          Bs. {priceInVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>

                    <div>
                      {isOutOfStock ? (
                        <span className="text-xs text-neutral-500 font-mono">Agotado</span>
                      ) : hasOptions ? (
                        <button
                          onClick={() => onOpenProductModal(product)}
                          className="bg-neutral-800 hover:bg-neutral-700 text-white font-mono text-xs font-bold px-4 py-2.5 rounded-xl transition"
                        >
                          Variantes
                        </button>
                      ) : qty > 0 ? (
                        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-700 rounded-xl px-2.5 py-1.5 shadow-inner">
                          <button
                            onClick={() => onAddToCart(product, qty - 1)}
                            className="w-6 h-6 flex items-center justify-center text-neutral-300 hover:text-white"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-mono font-black text-amber-400 w-5 text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() => onAddToCart(product, qty + 1)}
                            className="w-6 h-6 flex items-center justify-center text-neutral-300 hover:text-white"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onAddToCart(product, 1)}
                          className="bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black font-black text-xs px-4 py-2.5 rounded-xl transition shadow-lg shadow-amber-400/10 font-mono active:scale-95"
                        >
                          + Agregar
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

      {/* 6. Floating Checkout Footer Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-16 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40 animate-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={onOpenCart}
            className="w-full bg-gradient-to-r from-amber-400 to-yellow-400 text-black p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center justify-between hover:shadow-amber-400/20 active:scale-[0.99] transition font-mono font-black"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="bg-black text-amber-400 text-xs px-2.5 py-1 rounded-full font-black flex-shrink-0">
                {cartCount}
              </span>
              <span className="text-xs uppercase tracking-wider truncate">Enviar al Mostrador</span>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-sm sm:text-base font-black">${cartAmount.toFixed(2)}</span>
                <ChevronRight className="w-4 h-4 text-black" />
              </div>
              {showVES && (
                <span className="text-[9px] sm:text-[10px] text-neutral-900 block font-black">
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

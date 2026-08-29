'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { ShoppingBag, Search, ArrowUpRight } from 'lucide-react';
import { type ProductItem, type TenantConfig } from '@/components/storefront-client';
import { DEFAULT_PRODUCT_IMAGE_URL } from '@/lib/constants';
import { SafeProductImage } from '@/components/safe-product-image';

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

export function ThemeFashionBoutique({
  tenant,
  products,
  categories,
  cartCount,
  cartAmount,
  onOpenCart,
  onOpenProductModal,
}: ThemeProps) {
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGender, setActiveGender] = useState<'ALL' | 'WOMEN' | 'MEN'>('ALL');

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
    <div className="min-h-screen bg-[#fbf9f6] text-[#1e1b18] selection:bg-[#dfd5cb] pb-36 font-sans w-full max-w-full overflow-x-hidden">
      {/* 1. Haute Couture Top Banner */}
      <div className="bg-[#1e1b18] text-[#e8ded5] text-[10px] sm:text-[11px] uppercase tracking-[0.2em] py-2 px-4 text-center font-bold flex items-center justify-center gap-2 border-b border-[#2d2825]">
        <span>Colección Textil & Sastrería 2026</span>
        {showVES && (
          <span className="flex items-center gap-1.5 text-amber-400 font-mono bg-white/10 px-2.5 py-0.5 rounded-full text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            Tasa Oficial Binance P2P: {exchangeRate.toFixed(2)} Bs/$
          </span>
        )}
      </div>

      {/* 2. Editorial Header */}
      <header className="sticky top-0 z-40 bg-[#fbf9f6]/95 backdrop-blur-md border-b border-[#ece5dd]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-6">
          <div className="flex items-center gap-4 sm:gap-6 min-w-0 flex-1">
            <div className="min-w-0">
              <span className="text-[9px] tracking-[0.3em] text-[#8c827a] uppercase block">
                Atelier & Studio
              </span>
              <h1 className="font-serif text-lg sm:text-2xl tracking-tight text-[#1c1815] font-normal truncate">
                {tenant.name}
              </h1>
            </div>

            {/* Sub Nav Links */}
            <nav className="hidden md:flex items-center gap-6 text-xs uppercase tracking-[0.15em] text-[#5c544d]">
              <button
                onClick={() => setActiveGender('ALL')}
                className={`transition ${activeGender === 'ALL' ? 'text-black font-bold underline underline-offset-8' : 'hover:text-black'}`}
              >
                Todo
              </button>
              <button
                onClick={() => setActiveGender('WOMEN')}
                className={`transition ${activeGender === 'WOMEN' ? 'text-black font-bold underline underline-offset-8' : 'hover:text-black'}`}
              >
                Mujer
              </button>
              <button
                onClick={() => setActiveGender('MEN')}
                className={`transition ${activeGender === 'MEN' ? 'text-black font-bold underline underline-offset-8' : 'hover:text-black'}`}
              >
                Hombre
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={onOpenCart}
              className="relative px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-[#1e1b18] text-white text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-black transition-all flex items-center gap-2 shadow-md active:scale-95 flex-shrink-0"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bolsa</span>
              <span>({cartCount})</span>
            </button>
          </div>
        </div>
      </header>

      {/* 3. Luxury Editorial Hero Banner */}
      <section className="max-w-6xl mx-auto px-6 pt-6">
        <div className="relative rounded-3xl overflow-hidden bg-[#1e1b18] text-white aspect-[21/9] sm:aspect-[24/8] flex items-center shadow-lg">
          <Image
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80"
            alt="Editorial Fashion Campaign"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1152px"
            className="w-full h-full object-cover opacity-60 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
          <div className="relative z-10 p-6 sm:p-12 max-w-xl space-y-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#dfd5cb] block">
              Prendas & Confección 100% Original
            </span>
            <h2 className="font-serif text-2xl sm:text-4xl leading-tight font-normal">
              Cortes Contemporáneos, Lino & Algodón Orgánico.
            </h2>
            <p className="text-xs text-[#d3c9bf] font-light max-w-sm hidden sm:block">
              Vestidos, camisetas heavyweight, denim vintage y chaquetas con entrega directa.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Filter Bar */}
      <main className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#ece5dd] pb-5">
          <div className="flex gap-4 overflow-x-auto no-scrollbar w-full sm:w-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs uppercase tracking-[0.18em] pb-1 border-b-2 transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'border-[#1e1b18] text-[#1e1b18] font-black'
                    : 'border-transparent text-[#8c827a] hover:text-[#1e1b18]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c827a]" />
            <input
              type="text"
              placeholder="Buscar vestidos, camisetas, denim, hoodies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-[#e5ded5] rounded-full text-xs placeholder:text-[#8c827a] text-[#1e1b18] focus:outline-none focus:border-[#1e1b18] shadow-xs"
            />
          </div>
        </div>

        {/* 5. Portrait 3:4 & 4:5 Responsive Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-24 text-center text-[#8c827a] font-serif italic text-sm">
            No se encontraron prendas en esta sección.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
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
                  onClick={() => onOpenProductModal(product)}
                  className="group cursor-pointer flex flex-col justify-between"
                >
                  {/* Portrait Image Card */}
                  <div className="relative aspect-[3/4] bg-[#ece5dd] rounded-3xl overflow-hidden shadow-xs group-hover:shadow-xl transition-all duration-500">
                    <SafeProductImage
                      src={imageUrl}
                      alt={product.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />

                    {/* Aesthetic Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                      {product.featured && (
                        <span className="bg-[#1e1b18]/90 backdrop-blur-md text-white text-[8px] uppercase tracking-[0.2em] px-3 py-1 rounded-full font-medium shadow-sm">
                          Tendencia
                        </span>
                      )}
                      <span className="bg-white/90 backdrop-blur-md text-[#1e1b18] text-[8px] uppercase tracking-[0.15em] px-2.5 py-0.5 rounded-full font-bold shadow-xs">
                        {product.sku}
                      </span>
                    </div>

                    {/* Color Swatch Dots Overlay */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/80 backdrop-blur-md px-2.5 py-1 rounded-full">
                      <span className="w-2.5 h-2.5 rounded-full bg-black border border-white"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-[#d4c3b3] border border-white"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-300"></span>
                    </div>

                    {/* Quick View Button */}
                    <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-8 h-8 rounded-full bg-[#1e1b18] text-white flex items-center justify-center shadow-lg">
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                    </div>

                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="text-[10px] uppercase tracking-[0.2em] bg-white text-[#1e1b18] px-4 py-2 rounded-full font-black shadow-md">
                          Agotado
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Information Details */}
                  <div className="pt-3.5 space-y-1">
                    <span className="text-[9px] uppercase tracking-[0.2em] text-[#8c827a] block">
                      {product.category?.name || 'Prenda Exclusiva'}
                    </span>
                    <h3 className="font-serif text-sm sm:text-base text-[#1c1815] group-hover:underline underline-offset-4 decoration-1 font-normal truncate">
                      {product.title}
                    </h3>
                    <div className="flex flex-col pt-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#1e1b18]">
                          {hasOptions && <span className="text-[10px] font-normal text-[#8c827a] mr-1">Desde</span>}
                          ${product.price.toFixed(2)} USD
                        </span>
                        <span className="text-[9px] text-emerald-700 uppercase font-bold tracking-wider">
                          Disponible
                        </span>
                      </div>
                      {showVES && (
                        <span className="text-[11px] font-bold text-[#8c827a]">
                          Bs. {priceInVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
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
            className="w-full bg-[#1e1b18] text-white p-3.5 sm:p-4 rounded-full shadow-2xl flex items-center justify-between hover:bg-black active:scale-[0.99] transition uppercase tracking-[0.2em] text-xs font-medium border border-[#3e3833]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="bg-[#e8ded5] text-[#1e1b18] text-[10px] font-black px-2.5 py-0.5 rounded-full flex-shrink-0">
                {cartCount}
              </span>
              <span className="text-xs truncate">Procesar Bolsa</span>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <span className="font-bold text-sm tracking-normal block">${cartAmount.toFixed(2)}</span>
              {showVES && (
                <span className="text-[9px] text-[#dfd5cb] tracking-normal font-sans font-medium block">
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

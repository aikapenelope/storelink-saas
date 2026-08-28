'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { ShoppingBag, Search } from 'lucide-react';
import { type ProductItem, type TenantConfig } from '@/components/storefront-client';
import { DEFAULT_PRODUCT_IMAGE_URL } from '@/lib/constants';

interface ThemeProps {
  tenant: TenantConfig;
  products: ProductItem[];
  categories: string[];
  cartCount: number;
  cartAmount: number;
  onOpenCart: () => void;
  onOpenProductModal: (product: ProductItem) => void;
  onAddToCart?: (product: ProductItem, quantity: number) => void;
}

export function ThemeEditorial({
  tenant,
  products,
  categories,
  cartCount,
  onOpenCart,
  onOpenProductModal,
}: ThemeProps) {
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');

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
    <div className="min-h-screen bg-[#faf8f5] text-[#2d2825] selection:bg-[#ebdcd0] pb-36 font-sans w-full max-w-full overflow-x-hidden">
      {/* 0. Real-time Exchange Rate Top Strip */}
      {showVES && (
        <div className="bg-[#2d2825] text-[#faf8f5] text-xs py-1.5 px-4 text-center font-serif flex items-center justify-center gap-2 border-b border-[#3d3632]">
          <span className="text-[11px] uppercase tracking-widest text-[#ebdcd0]">Tasa del Día:</span>
          <span className="font-mono bg-[#3d3632] text-white px-2 py-0.5 rounded text-[11px] font-bold">
            {exchangeRate.toFixed(2)} Bs/$
          </span>
        </div>
      )}

      {/* 1. Luxury Editorial Header */}
      <header className="sticky top-0 z-40 bg-[#faf8f5]/95 backdrop-blur-md border-b border-[#ece5dd]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
          <div className="text-left min-w-0">
            <span className="text-[9px] sm:text-[10px] tracking-[0.25em] text-[#8c827a] uppercase block">
              Lookbook Boutique
            </span>
            <h1 className="font-serif text-lg sm:text-2xl tracking-tight text-[#1c1815] font-normal truncate">
              {tenant.name}
            </h1>
          </div>

          <button
            onClick={onOpenCart}
            className="relative px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full border border-[#2d2825] text-[11px] sm:text-xs uppercase tracking-widest font-bold hover:bg-[#2d2825] hover:text-white active:scale-95 transition-all flex items-center gap-1.5 flex-shrink-0"
            aria-label="Abrir bolsa de compras"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bolsa</span>
            {cartCount > 0 && (
              <span className="bg-[#2d2825] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 2. Editorial Headline & Search */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 border-b border-[#ece5dd] text-center">
        <p className="font-serif italic text-base sm:text-2xl text-[#5c544d] max-w-xl mx-auto leading-relaxed">
          &ldquo;{tenant.welcomeMessage || 'Piezas y artículos seleccionados con atención al detalle.'}&rdquo;
        </p>

        {/* Minimal Search */}
        <div className="mt-4 sm:mt-6 max-w-md mx-auto relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c827a]" />
          <input
            type="text"
            placeholder="Buscar en la colección..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2 sm:py-2.5 bg-white/90 border border-[#e5ded5] rounded-full text-xs placeholder:text-[#8c827a] text-[#2d2825] focus:outline-none focus:border-[#2d2825] shadow-xs font-medium"
          />
        </div>
      </div>

      {/* 3. Categories Tabs */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex justify-start sm:justify-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`text-xs uppercase tracking-[0.15em] pb-1.5 border-b-2 whitespace-nowrap transition-all flex-shrink-0 ${
              selectedCategory === cat
                ? 'border-[#2d2825] text-[#2d2825] font-bold'
                : 'border-transparent text-[#8c827a] hover:text-[#2d2825]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 4. Lookbook 4:5 Vertical Cards Grid (2-cols on mobile, 3 on desktop) */}
      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-[#8c827a] font-serif italic text-sm bg-white/60 rounded-2xl border border-[#ece5dd] p-8">
            No se encontraron artículos en esta sección.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-8">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.stockStatus === 'out_of_stock';
              const priceVES = showVES ? product.price * exchangeRate : 0;
              const imageUrl =
                product.images?.[0]?.url ||
                DEFAULT_PRODUCT_IMAGE_URL;

              return (
                <div
                  key={product.id}
                  onClick={() => onOpenProductModal(product)}
                  className="group cursor-pointer flex flex-col justify-between bg-white/80 sm:bg-transparent rounded-2xl sm:rounded-none p-2.5 sm:p-0 border border-[#ece5dd] sm:border-0 shadow-xs sm:shadow-none hover:shadow-md transition"
                >
                  {/* Image 4:5 Portrait */}
                  <div className="relative aspect-[4/5] bg-[#ece5dd] rounded-xl overflow-hidden shadow-xs">
                    <Image
                      src={imageUrl}
                      alt={product.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                    {product.featured && (
                      <span className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-[#2d2825]/90 backdrop-blur-md text-white text-[8px] sm:text-[9px] uppercase tracking-widest px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full font-medium">
                        Exclusivo
                      </span>
                    )}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-[#2d2825]/50 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="text-[10px] sm:text-xs uppercase tracking-widest bg-white text-[#2d2825] px-3 py-1 rounded-full font-bold shadow-md">
                          Agotado
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="pt-2.5 sm:pt-4 text-center">
                    <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#8c827a] block">
                      {product.sku}
                    </span>
                    <h3 className="font-serif text-xs sm:text-base text-[#1c1815] group-hover:underline underline-offset-4 decoration-1 mt-0.5 line-clamp-1">
                      {product.title}
                    </h3>
                    <div className="mt-1">
                      <span className="text-xs sm:text-sm font-bold text-[#2d2825]">
                        ${product.price.toFixed(2)}
                      </span>
                      {showVES && (
                        <span className="text-[10px] text-[#8c827a] font-mono block">
                          Bs. {priceVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
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

      {/* 5. Floating Bottom Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-14 sm:bottom-6 left-0 right-0 z-40 max-w-md mx-auto px-4 sm:px-6 pointer-events-none">
          <button
            onClick={onOpenCart}
            className="pointer-events-auto w-full bg-[#2d2825] text-white p-3.5 sm:p-4 rounded-full shadow-2xl flex items-center justify-between hover:bg-black active:scale-[0.99] transition uppercase tracking-widest text-[11px] sm:text-xs font-bold border border-[#4a423d]"
          >
            <div className="flex items-center gap-2.5">
              <span className="bg-white text-[#2d2825] text-[10px] font-black px-2 py-0.5 rounded-full">
                {cartCount}
              </span>
              <span>Completar Pedido</span>
            </div>
            <span className="font-bold text-xs sm:text-sm tracking-normal font-mono">
              ${cartAmount.toFixed(2)}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

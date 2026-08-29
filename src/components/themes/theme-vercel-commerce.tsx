'use client';

import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, ArrowRight } from 'lucide-react';
import { type ProductItem, type TenantConfig } from '@/components/storefront-client';
import { DEFAULT_PRODUCT_IMAGE_URL } from '@/lib/constants';
import { SafeProductImage } from '@/components/safe-product-image';

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

export function ThemeVercelCommerce({
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
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black pb-36 font-sans w-full max-w-full overflow-x-hidden">
      {/* 0. Live Binance / Crypto Exchange Rate Strip */}
      {showVES && (
        <div className="bg-neutral-900 text-neutral-300 text-xs py-1.5 px-4 text-center font-mono flex items-center justify-center gap-2 border-b border-neutral-800">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-emerald-400 font-bold uppercase">Rate (USD/VES):</span>
          <span className="bg-black text-white px-2 py-0.5 rounded text-[11px] font-bold border border-neutral-700">
            {exchangeRate.toFixed(2)} Bs/$
          </span>
        </div>
      )}

      {/* 1. Vercel Commerce Minimalist Nav */}
      <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg border border-neutral-700 bg-neutral-900 flex items-center justify-center font-black text-xs sm:text-sm flex-shrink-0">
              ▲
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white truncate">
                {tenant.name}
              </h1>
              <span className="text-[9px] sm:text-[10px] text-neutral-400 uppercase tracking-widest block font-mono truncate">
                StoreLink High-Speed Commerce
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onOpenCart}
              className="h-9 sm:h-10 px-3.5 sm:px-4 bg-white text-black font-bold text-xs rounded-full hover:bg-neutral-200 active:scale-95 transition flex items-center gap-2 shadow-xs"
              aria-label="Abrir carrito"
            >
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span className="bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Banner Minimal */}
      <div className="border-b border-neutral-850 bg-neutral-950 py-5 sm:py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <span className="text-[10px] sm:text-xs font-mono text-emerald-400 flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              CATÁLOGO EN TIEMPO REAL
            </span>
            <h2 className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight">
              {tenant.welcomeMessage || 'Explore all items in our curated catalog'}
            </h2>
          </div>

          {/* Search Input in Hero */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar productos, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 sm:py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs placeholder:text-neutral-500 text-white focus:outline-none focus:border-neutral-500 font-mono shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* 3. Category Filter Bar */}
      <div className="max-w-6xl mx-auto px-4 py-3 flex gap-1.5 overflow-x-auto no-scrollbar border-b border-neutral-900 sticky top-14 sm:top-16 z-30 bg-black/95 backdrop-blur-md">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider whitespace-nowrap transition ${
              selectedCategory === cat
                ? 'bg-white text-black font-bold shadow-xs'
                : 'text-neutral-400 hover:text-white border border-neutral-850 hover:border-neutral-700 bg-neutral-950'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 4. Grid of Products (Vercel Commerce Bento Style) */}
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center border border-neutral-800 rounded-2xl bg-neutral-950 p-6">
            <p className="text-neutral-500 text-sm font-mono">No matching products found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
                  className="group relative bg-neutral-950 border border-neutral-800 hover:border-neutral-600 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between cursor-pointer shadow-xs hover:shadow-xl"
                >
                  {/* Image Container */}
                  <div className="relative aspect-square w-full bg-neutral-900 overflow-hidden">
                    <SafeProductImage
                      src={imageUrl}
                      alt={product.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />

                    {/* Vercel Style Price Tag Badge (Bottom Left overlay) */}
                    <div className="absolute bottom-3 left-3 bg-black/90 backdrop-blur-md border border-neutral-800 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-xl">
                      <span className="text-xs sm:text-sm font-bold text-white font-mono">
                        ${product.price.toFixed(2)}
                      </span>
                      {showVES ? (
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">
                          Bs. {priceVES.toFixed(0)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-400 uppercase font-mono">
                          {tenant.currency || 'USD'}
                        </span>
                      )}
                    </div>

                    {product.featured && (
                      <div className="absolute top-3 right-3 bg-white text-black text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase shadow-xs">
                        Featured
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-3.5 sm:p-4 border-t border-neutral-900 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-mono text-neutral-500 uppercase truncate">
                        {product.sku}
                      </p>
                      <h3 className="font-semibold text-xs sm:text-sm text-white truncate group-hover:text-emerald-400 transition mt-0.5">
                        {product.title}
                      </h3>
                    </div>

                    <div className="flex-shrink-0">
                      {isOutOfStock ? (
                        <span className="text-[10px] font-mono text-rose-400 bg-rose-950/40 border border-rose-900/50 px-2 py-1 rounded">
                          Sold Out
                        </span>
                      ) : (
                        <div className="w-8 h-8 rounded-full border border-neutral-700 group-hover:border-white group-hover:bg-white group-hover:text-black flex items-center justify-center text-neutral-400 transition">
                          <ArrowRight className="w-4 h-4" />
                        </div>
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
        <div className="fixed bottom-14 sm:bottom-6 left-0 right-0 z-40 max-w-md mx-auto px-4 pointer-events-none">
          <button
            onClick={onOpenCart}
            className="pointer-events-auto w-full bg-white text-black p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-neutral-200 hover:bg-neutral-100 active:scale-[0.99] transition font-mono"
          >
            <div className="flex items-center gap-2.5">
              <span className="bg-black text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {cartCount}
              </span>
              <span className="font-bold text-xs uppercase tracking-wider">Checkout</span>
            </div>
            <div className="text-right">
              <span className="text-sm sm:text-base font-black block">
                ${cartAmount.toFixed(2)}
              </span>
              {showVES && (
                <span className="text-[10px] text-neutral-600 font-mono block font-medium">
                  Bs. {(cartAmount * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

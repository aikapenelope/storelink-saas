'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { ShoppingBag, Search, Plus, Minus, Info, Sparkles } from 'lucide-react';
import { type ProductItem, type TenantConfig } from '@/components/storefront-client';
import { DEFAULT_PRODUCT_IMAGE_URL } from '@/lib/constants';

interface ThemeProps {
  tenant: TenantConfig;
  products: ProductItem[];
  categories: string[];
  cartCount: number;
  cartAmount: number;
  cart: Array<{ id: string; quantity: number }>;
  onOpenCart: () => void;
  onOpenProductModal: (product: ProductItem) => void;
  onAddToCart: (product: ProductItem, quantity: number) => void;
}

export function ThemeFluidPWA({
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
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-36 font-sans w-full max-w-full overflow-x-hidden">
      {/* 0. Live Real-time Exchange Rate Top Strip */}
      {showVES && (
        <div className="bg-slate-950 text-slate-200 text-xs py-1.5 px-4 text-center font-bold flex items-center justify-center gap-2 border-b border-slate-800">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-emerald-400 font-extrabold">Tasa en Vivo:</span>
          <span className="font-mono bg-slate-800 text-white px-2 py-0.5 rounded text-[11px]">
            {exchangeRate.toFixed(2)} Bs/$
          </span>
        </div>
      )}

      {/* 1. App Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-base sm:text-lg shadow-sm flex-shrink-0">
              {tenant.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {tenant.name}
              </h1>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block truncate">
                {tenant.welcomeMessage || 'Catálogo interactivo con pedidos por WhatsApp'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCart}
              className="relative px-3.5 sm:px-4 py-2 bg-emerald-50 text-emerald-800 rounded-xl hover:bg-emerald-100 active:scale-95 transition-all flex items-center gap-2 font-bold text-xs shadow-xs"
              aria-label="Ver carrito"
            >
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Mi Pedido</span>
              {cartCount > 0 && (
                <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full font-black shadow-xs">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Container */}
      <main className="max-w-6xl mx-auto px-3.5 sm:px-4 pt-4 sm:pt-6 space-y-4 sm:space-y-6">
        {/* Search & Category Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar productos o código SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 sm:py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs font-medium"
            />
          </div>

          {/* Category Pills Bar */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-xs ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-slate-900/10'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid Responsive (1 col on mobile, 2 on tablet, 3 on desktop) */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
            <p className="text-slate-400 text-sm">No se encontraron productos en esta categoría.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {filteredProducts.map((product) => {
              const inCart = cart.find((item) => item.id === product.id);
              const qty = inCart ? inCart.quantity : 0;
              const isOutOfStock = product.stockStatus === 'out_of_stock';
              const hasOptions =
                (product.variants && product.variants.length > 0) ||
                (product.modifiers && product.modifiers.length > 0);
              const priceVES = showVES ? product.price * exchangeRate : 0;
              const imageUrl =
                product.images?.[0]?.url ||
                DEFAULT_PRODUCT_IMAGE_URL;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs flex gap-3 sm:gap-4 items-center transition hover:shadow-md hover:border-slate-300"
                >
                  {/* Product Image */}
                  <div
                    onClick={() => onOpenProductModal(product)}
                    className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 cursor-pointer group"
                  >
                    <Image
                      src={imageUrl}
                      alt={product.title}
                      fill
                      sizes="(max-width: 640px) 96px, 112px"
                      className="object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Info className="w-5 h-5 text-white drop-shadow" />
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] sm:text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider">
                        {product.sku}
                      </span>
                      {product.featured && (
                        <span className="bg-amber-100 text-amber-800 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" /> Top
                        </span>
                      )}
                    </div>
                    <h2
                      onClick={() => onOpenProductModal(product)}
                      className="font-bold text-slate-800 text-xs sm:text-sm leading-snug truncate cursor-pointer hover:text-emerald-600 transition mt-0.5"
                    >
                      {product.title}
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1 sm:line-clamp-2 mt-0.5">
                      {product.description}
                    </p>

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-emerald-700 font-black text-sm sm:text-base block">
                          ${product.price.toFixed(2)}
                        </span>
                        {showVES && (
                          <span className="text-[10px] text-slate-500 font-mono block">
                            Bs. {priceVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>

                      {/* Stock or Cart Action */}
                      {isOutOfStock ? (
                        <span className="text-[10px] font-semibold text-rose-500 bg-rose-50 px-2 py-1 rounded-md">
                          Agotado
                        </span>
                      ) : hasOptions ? (
                        <button
                          onClick={() => onOpenProductModal(product)}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs active:scale-95 transition"
                        >
                          Opciones
                        </button>
                      ) : qty > 0 ? (
                        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl p-1">
                          <button
                            onClick={() => onAddToCart(product, qty - 1)}
                            className="w-7 h-7 flex items-center justify-center text-emerald-800 hover:bg-emerald-200/60 rounded-lg active:scale-95"
                            aria-label="Disminuir"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-black text-emerald-900 w-5 text-center font-mono">
                            {qty}
                          </span>
                          <button
                            onClick={() => onAddToCart(product, qty + 1)}
                            className="w-7 h-7 flex items-center justify-center text-emerald-800 hover:bg-emerald-200/60 rounded-lg active:scale-95"
                            aria-label="Aumentar"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onAddToCart(product, 1)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs active:scale-95 transition"
                        >
                          Añadir
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

      {/* 3. Fixed Floating Bottom Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-14 sm:bottom-6 left-0 right-0 z-40 max-w-lg mx-auto px-4 pointer-events-none">
          <button
            onClick={onOpenCart}
            className="pointer-events-auto w-full bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-800 hover:bg-slate-800 active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-2.5">
              <span className="bg-emerald-500 text-slate-950 text-xs font-black px-2.5 py-1 rounded-full">
                {cartCount} {cartCount === 1 ? 'ítem' : 'ítems'}
              </span>
              <span className="font-bold text-xs sm:text-sm">Ver Pedido Completo</span>
            </div>
            <div className="text-right">
              <span className="text-sm sm:text-base font-black text-emerald-400 block font-mono">
                ${cartAmount.toFixed(2)}
              </span>
              {showVES && (
                <span className="text-[10px] text-slate-400 font-mono block">
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

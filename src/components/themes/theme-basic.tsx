'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { ShoppingBag, Search, Plus, Minus } from 'lucide-react';
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

export function ThemeBasicBanner({
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

      {/* 1. Header Banner Image (Plan Básico Hero Banner) */}
      <div className="relative h-44 sm:h-60 w-full bg-slate-800 overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80"
          alt="Banner de la Tienda"
          fill
          priority
          sizes="100vw"
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Plan Badge */}
        <div className="absolute top-3 left-4 bg-white/90 backdrop-blur-md text-slate-900 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
          Plan Básico
        </div>
      </div>

      {/* 2. Store Profile Overlay Bar */}
      <div className="max-w-5xl mx-auto px-4 -mt-12 relative z-10">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Store Avatar Logo */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-900 text-white font-black text-2xl flex items-center justify-center shadow-md border-4 border-white flex-shrink-0">
              {tenant.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {tenant.name}
                </h1>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 max-w-md line-clamp-1 sm:line-clamp-none">
                {tenant.welcomeMessage || 'Catálogo oficial de productos con pedidos por WhatsApp.'}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenCart}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
          >
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <span>Ver Pedido</span>
            {cartCount > 0 && (
              <span className="bg-emerald-500 text-slate-950 text-xs px-2 py-0.5 rounded-full font-black">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 3. Sticky Search & Filter Bar */}
      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar productos en el catálogo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 font-medium"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Simple Clean Product List/Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
            <p className="text-slate-400 text-sm font-bold">No hay productos disponibles en esta sección.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                  className="bg-white rounded-2xl p-3.5 border border-slate-200 hover:border-slate-300 shadow-xs flex flex-col justify-between transition hover:shadow-md"
                >
                  <div>
                    {/* Image */}
                    <div
                      onClick={() => onOpenProductModal(product)}
                      className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-100 cursor-pointer"
                    >
                      <SafeProductImage
                        src={imageUrl}
                        alt={product.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="w-full h-full object-cover hover:scale-105 transition duration-300"
                      />
                      <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                        {product.sku}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="pt-3">
                      <h3
                        onClick={() => onOpenProductModal(product)}
                        className="font-bold text-sm text-slate-900 hover:text-emerald-700 transition cursor-pointer truncate"
                      >
                        {product.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                        {product.description || 'Sin descripción adicional.'}
                      </p>
                    </div>
                  </div>

                  {/* Pricing & Add Action */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-1">
                        {hasOptions && <span className="text-[10px] text-slate-400">Desde</span>}
                        <span className="text-slate-900 font-extrabold text-base">
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
                        <span className="text-xs text-rose-500 font-bold bg-rose-50 px-2 py-1 rounded">
                          Agotado
                        </span>
                      ) : hasOptions ? (
                        <button
                          onClick={() => onOpenProductModal(product)}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition"
                        >
                          Opciones
                        </button>
                      ) : qty > 0 ? (
                        <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 rounded-lg px-2 py-1">
                          <button
                            onClick={() => onAddToCart(product, qty - 1)}
                            className="w-5 h-5 flex items-center justify-center text-slate-700 hover:bg-slate-200 rounded"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-black text-slate-900 w-4 text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() => onAddToCart(product, qty + 1)}
                            className="w-5 h-5 flex items-center justify-center text-slate-700 hover:bg-slate-200 rounded"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onAddToCart(product, 1)}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-xs transition"
                        >
                          + Añadir
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

      {/* Floating Bottom Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-16 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40 animate-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={onOpenCart}
            className="w-full bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center justify-between hover:bg-slate-800 active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="bg-emerald-500 text-slate-950 text-xs px-2.5 py-1 rounded-full font-black flex-shrink-0">
                {cartCount}
              </span>
              <span className="font-bold text-xs sm:text-sm truncate">Enviar Pedido WhatsApp</span>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <span className="text-sm sm:text-base font-black text-emerald-400 block font-mono">${cartAmount.toFixed(2)}</span>
              {showVES && (
                <span className="text-[9px] sm:text-[10px] text-slate-300 font-mono block">
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

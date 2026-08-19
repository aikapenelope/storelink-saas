'use client';

import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, Plus, Minus, Info, Sparkles, Flame, Clock } from 'lucide-react';
import { type ProductItem, type TenantConfig } from '@/components/storefront-client';

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

export function ThemeFoodDelivery({
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
    <div className="min-h-screen bg-[#faf9f6] text-slate-900 pb-32">
      {/* Header with Warm Food Theme */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-orange-100 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white font-black text-lg shadow-sm">
              🍔
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black tracking-tight text-slate-900">
                  {tenant.name}
                </h1>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Abierto
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-orange-500" /> 25-35 min</span>
                <span>•</span>
                <span>{tenant.welcomeMessage || 'Pedidos directos a tu WhatsApp con entrega rápida'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onOpenCart}
            className="relative px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full transition-all flex items-center gap-2 font-bold text-xs shadow-md shadow-orange-500/20 active:scale-95"
            aria-label="Ver carrito"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Mi Pedido</span>
            {cartCount > 0 && (
              <span className="bg-white text-orange-600 text-xs px-2 py-0.5 rounded-full font-black">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* Search & Category Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar hamburguesas, pizzas, bebidas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-xs"
            />
          </div>

          {/* Category Pills Bar */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-xs ${
                  selectedCategory === cat
                    ? 'bg-orange-500 text-white shadow-orange-500/20'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-orange-50/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
            <p className="text-slate-400 text-sm">No encontramos platillos en esta categoría.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex gap-4 items-center transition hover:shadow-md hover:border-orange-200"
                >
                  <div
                    onClick={() => onOpenProductModal(product)}
                    className="relative w-28 h-28 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 cursor-pointer group"
                  >
                    <img
                      src={imageUrl}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    {product.featured && (
                      <div className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                        <Flame className="w-2.5 h-2.5 fill-white" /> Popular
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {product.sku}
                    </span>
                    <h2
                      onClick={() => onOpenProductModal(product)}
                      className="font-bold text-slate-900 text-sm leading-tight truncate cursor-pointer hover:text-orange-600 transition mt-0.5"
                    >
                      {product.title}
                    </h2>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                      {product.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-orange-600 font-black text-base">
                        {hasOptions && <span className="text-xs font-normal text-slate-500 mr-1">Desde</span>}
                        ${product.price.toFixed(2)}
                      </span>

                      {isOutOfStock ? (
                        <span className="text-[11px] font-semibold text-rose-500 bg-rose-50 px-2 py-1 rounded-md">
                          Agotado
                        </span>
                      ) : hasOptions ? (
                        <button
                          onClick={() => onOpenProductModal(product)}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-xs active:scale-95 transition"
                        >
                          Personalizar
                        </button>
                      ) : qty > 0 ? (
                        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1">
                          <button
                            onClick={() => onAddToCart(product, qty - 1)}
                            className="w-5 h-5 flex items-center justify-center text-orange-800 hover:bg-orange-200/60 rounded"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-black text-orange-950 w-4 text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() => onAddToCart(product, qty + 1)}
                            className="w-5 h-5 flex items-center justify-center text-orange-800 hover:bg-orange-200/60 rounded"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onAddToCart(product, 1)}
                          className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-xs active:scale-95 transition"
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

      {/* Floating Bottom Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 z-40 max-w-lg mx-auto px-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <button
            onClick={onOpenCart}
            className="w-full bg-slate-950 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-800 hover:bg-slate-900 active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3">
              <span className="bg-orange-500 text-white text-xs font-black px-3 py-1 rounded-full">
                {cartCount} {cartCount === 1 ? 'platillo' : 'platillos'}
              </span>
              <span className="font-bold text-sm">Completar Pedido por WhatsApp</span>
            </div>
            <span className="text-base font-black text-orange-400">
              ${cartAmount.toFixed(2)}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

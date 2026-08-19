'use client';

import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, ArrowRight, Sparkles, Filter } from 'lucide-react';
import { type ProductItem, type TenantConfig } from '@/components/storefront-client';

interface ThemeProps {
  tenant: TenantConfig;
  products: ProductItem[];
  categories: string[];
  cartCount: number;
  cartAmount: number;
  onOpenCart: () => void;
  onOpenProductModal: (product: ProductItem) => void;
  onAddToCart: (product: ProductItem, quantity: number) => void;
}

export function ThemeVercelCommerce({
  tenant,
  products,
  categories,
  cartCount,
  cartAmount,
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
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      {/* Vercel Commerce Minimalist Nav */}
      <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-neutral-700 bg-neutral-900 flex items-center justify-center font-black text-sm">
              ▲
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-white">{tenant.name}</h1>
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest block font-mono">
                StoreLink Powered
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenCart}
              className="h-10 px-4 bg-white text-black font-semibold text-xs rounded-full hover:bg-neutral-200 transition flex items-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Cart</span>
              {cartCount > 0 && (
                <span className="bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner Minimal */}
      <div className="border-b border-neutral-800 bg-neutral-950 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              LIVE CATALOG
            </span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">
              {tenant.welcomeMessage || 'Explore all items in our curated catalog'}
            </h2>
          </div>

          {/* Search Input in Hero */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search products, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs placeholder:text-neutral-500 text-white focus:outline-none focus:border-neutral-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="max-w-6xl mx-auto px-4 py-4 flex gap-2 overflow-x-auto no-scrollbar border-b border-neutral-900">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition ${
              selectedCategory === cat
                ? 'bg-white text-black font-bold'
                : 'text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid of Products (Vercel Commerce Bento Style) */}
      <main className="max-w-6xl mx-auto px-4 py-8 pb-32">
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center border border-neutral-800 rounded-xl bg-neutral-950">
            <p className="text-neutral-500 text-sm font-mono">No matching products found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.stockStatus === 'out_of_stock';
              const imageUrl =
                product.images?.[0]?.url ||
                'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

              return (
                <div
                  key={product.id}
                  onClick={() => onOpenProductModal(product)}
                  className="group relative bg-neutral-950 border border-neutral-850 hover:border-neutral-700 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between cursor-pointer"
                >
                  {/* Image Container */}
                  <div className="relative aspect-square w-full bg-neutral-900 overflow-hidden">
                    <img
                      src={imageUrl}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />

                    {/* Vercel Style Price Tag Badge (Bottom Left overlay) */}
                    <div className="absolute bottom-3 left-3 bg-black/85 backdrop-blur-md border border-neutral-800 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-xl">
                      <span className="text-xs font-bold text-white font-mono">
                        ${product.price.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-neutral-400 uppercase font-mono">
                        {tenant.currency || 'USD'}
                      </span>
                    </div>

                    {product.featured && (
                      <div className="absolute top-3 right-3 bg-white text-black text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase">
                        Featured
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4 border-t border-neutral-900 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono text-neutral-500 uppercase">{product.sku}</p>
                      <h3 className="font-semibold text-sm text-white truncate group-hover:text-emerald-400 transition">
                        {product.title}
                      </h3>
                    </div>

                    <div className="flex-shrink-0">
                      {isOutOfStock ? (
                        <span className="text-[10px] font-mono text-rose-400 bg-rose-950/40 border border-rose-900/50 px-2 py-1 rounded">
                          Sold Out
                        </span>
                      ) : (
                        <div className="w-8 h-8 rounded-full border border-neutral-700 group-hover:border-white flex items-center justify-center text-neutral-400 group-hover:text-white transition">
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

      {/* Floating Bottom Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 z-40 max-w-md mx-auto px-4 animate-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={onOpenCart}
            className="w-full bg-white text-black p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-neutral-200 hover:bg-neutral-100 active:scale-[0.99] transition font-mono"
          >
            <div className="flex items-center gap-3">
              <span className="bg-black text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {cartCount}
              </span>
              <span className="font-bold text-xs uppercase tracking-wider">Review Order</span>
            </div>
            <span className="text-base font-black">${cartAmount.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, Sparkles, Heart } from 'lucide-react';
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

export function ThemeFashionBoutique({
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
    <div className="min-h-screen bg-[#faf8f5] text-[#2d2825] selection:bg-[#ebdcd0] pb-32">
      {/* Editorial Luxury Header */}
      <header className="sticky top-0 z-40 bg-[#faf8f5]/90 backdrop-blur-md border-b border-[#ece5dd]">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div>
            <span className="text-[10px] tracking-[0.25em] text-[#8c827a] uppercase block">
              Colección & Tendencias
            </span>
            <h1 className="font-serif text-2xl tracking-tight text-[#1c1815] font-normal">
              {tenant.name}
            </h1>
          </div>

          <button
            onClick={onOpenCart}
            className="relative px-5 py-2.5 rounded-full border border-[#2d2825] text-xs uppercase tracking-widest font-medium hover:bg-[#2d2825] hover:text-white transition-all flex items-center gap-2"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bolsa</span>
            {cartCount > 0 && (
              <span className="bg-[#2d2825] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 pt-6 space-y-6">
        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#ece5dd] pb-6">
          <div className="flex gap-4 overflow-x-auto no-scrollbar w-full sm:w-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs uppercase tracking-[0.15em] pb-1 border-b-2 transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'border-[#2d2825] text-[#2d2825] font-bold'
                    : 'border-transparent text-[#8c827a] hover:text-[#2d2825]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c827a]" />
            <input
              type="text"
              placeholder="Buscar vestidos, camisetas, tallas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/70 border border-[#e5ded5] rounded-full text-xs placeholder:text-[#8c827a] text-[#2d2825] focus:outline-none focus:border-[#2d2825]"
            />
          </div>
        </div>

        {/* 4:5 Vertical Cards Responsive Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-24 text-center text-[#8c827a] font-serif italic text-sm">
            No se encontraron prendas disponibles en esta sección.
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
                'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80';

              return (
                <div
                  key={product.id}
                  onClick={() => onOpenProductModal(product)}
                  className="group cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative aspect-[3/4] sm:aspect-[4/5] bg-[#ece5dd] rounded-2xl overflow-hidden shadow-xs">
                    <img
                      src={imageUrl}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    {product.featured && (
                      <span className="absolute top-3 left-3 bg-[#2d2825]/90 backdrop-blur-md text-white text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full">
                        Exclusivo
                      </span>
                    )}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-[#2d2825]/40 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="text-xs uppercase tracking-widest bg-white text-[#2d2825] px-3.5 py-1.5 rounded-full font-bold shadow-md">
                          Agotado
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 text-center sm:text-left">
                    <span className="text-[10px] uppercase tracking-widest text-[#8c827a] block">
                      {product.sku}
                    </span>
                    <h3 className="font-serif text-sm sm:text-base text-[#1c1815] group-hover:underline underline-offset-4 decoration-1 mt-0.5 truncate">
                      {product.title}
                    </h3>
                    <p className="text-xs font-bold text-[#5c544d] mt-1">
                      {hasOptions && <span className="text-[10px] font-normal text-[#8c827a] mr-1">Desde</span>}
                      ${product.price.toFixed(2)} {tenant.currency || 'USD'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 z-40 max-w-md mx-auto px-6 animate-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={onOpenCart}
            className="w-full bg-[#2d2825] text-white p-4 rounded-full shadow-2xl flex items-center justify-between hover:bg-black active:scale-[0.99] transition uppercase tracking-widest text-xs font-medium"
          >
            <div className="flex items-center gap-3">
              <span className="bg-white text-[#2d2825] text-[10px] font-bold px-2 py-0.5 rounded-full">
                {cartCount}
              </span>
              <span>Completar Pedido</span>
            </div>
            <span className="font-bold text-sm tracking-normal">${cartAmount.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

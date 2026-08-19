'use client';

import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, Sparkles } from 'lucide-react';
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

export function ThemeEditorial({
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
    <div className="min-h-screen bg-[#faf8f5] text-[#2d2825] selection:bg-[#ebdcd0]">
      {/* Luxury Editorial Header */}
      <header className="sticky top-0 z-40 bg-[#faf8f5]/90 backdrop-blur-md border-b border-[#ece5dd]">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="text-center md:text-left">
            <span className="text-[10px] tracking-[0.25em] text-[#8c827a] uppercase block">
              Boutique Collection
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
            <span>Bolsa</span>
            {cartCount > 0 && (
              <span className="bg-[#2d2825] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Editorial Headline */}
      <div className="max-w-5xl mx-auto px-6 py-10 border-b border-[#ece5dd] text-center">
        <p className="font-serif italic text-xl md:text-2xl text-[#5c544d] max-w-xl mx-auto leading-relaxed">
          &ldquo;{tenant.welcomeMessage || 'Piezas y artículos seleccionados con atención al detalle.'}&rdquo;
        </p>

        {/* Minimal Search */}
        <div className="mt-6 max-w-md mx-auto relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c827a]" />
          <input
            type="text"
            placeholder="Buscar en la colección..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white/70 border border-[#e5ded5] rounded-full text-xs placeholder:text-[#8c827a] text-[#2d2825] focus:outline-none focus:border-[#2d2825] transition"
          />
        </div>
      </div>

      {/* Categories Tabs */}
      <div className="max-w-5xl mx-auto px-6 py-6 flex justify-center gap-6 overflow-x-auto no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`text-xs uppercase tracking-[0.15em] pb-1 border-b transition-all ${
              selectedCategory === cat
                ? 'border-[#2d2825] text-[#2d2825] font-semibold'
                : 'border-transparent text-[#8c827a] hover:text-[#2d2825]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Lookbook 4:5 Vertical Cards Grid */}
      <main className="max-w-5xl mx-auto px-6 py-6 pb-36">
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-[#8c827a] font-serif italic text-sm">
            No se encontraron artículos en esta sección.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.stockStatus === 'out_of_stock';
              const imageUrl =
                product.images?.[0]?.url ||
                'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

              return (
                <div
                  key={product.id}
                  onClick={() => onOpenProductModal(product)}
                  className="group cursor-pointer flex flex-col justify-between"
                >
                  {/* Image 4:5 Portrait */}
                  <div className="relative aspect-[4/5] bg-[#ece5dd] rounded-xl overflow-hidden shadow-sm">
                    <img
                      src={imageUrl}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    {product.featured && (
                      <span className="absolute top-3 left-3 bg-[#2d2825]/85 backdrop-blur-md text-white text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full">
                        Exclusivo
                      </span>
                    )}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-[#2d2825]/40 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="text-xs uppercase tracking-widest bg-white text-[#2d2825] px-4 py-1.5 rounded-full font-medium shadow-md">
                          Agotado
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="pt-4 text-center">
                    <span className="text-[10px] uppercase tracking-widest text-[#8c827a]">
                      {product.sku}
                    </span>
                    <h3 className="font-serif text-base text-[#1c1815] group-hover:underline underline-offset-4 decoration-1 mt-0.5">
                      {product.title}
                    </h3>
                    <p className="text-xs font-semibold text-[#5c544d] mt-1">
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

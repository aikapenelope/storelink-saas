'use client';

import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, Hammer, Shield, CheckCircle, Plus, Minus, Tag } from 'lucide-react';
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

export function ThemeHardwareStore({
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
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-32">
      {/* Ferretería Header */}
      <header className="sticky top-0 z-40 bg-blue-900 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-sm">
              <Hammer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base tracking-tight">{tenant.name}</h1>
                <span className="bg-blue-800 text-blue-200 text-[10px] font-bold px-2 py-0.5 rounded">
                  FERRETERÍA & SUMINISTROS
                </span>
              </div>
              <p className="text-[11px] text-blue-200 hidden sm:block">
                {tenant.welcomeMessage || 'Herramientas, materiales y equipos con cotización directa.'}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenCart}
            className="h-10 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition flex items-center gap-2 shadow-md"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Cotizar Pedido ({cartCount})</span>
            <span className="bg-slate-950 text-amber-400 text-[11px] px-2 py-0.5 rounded font-mono">
              ${cartAmount.toFixed(2)}
            </span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* Search & Category Filter */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar taladros, tornillos, tuberías, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-blue-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Industrial Hardware Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center border border-slate-300 rounded-2xl bg-white">
            <p className="text-slate-400 text-sm">No hay herramientas registradas en esta sección.</p>
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
                'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80';

              return (
                <div
                  key={product.id}
                  className="bg-white border border-slate-200 hover:border-blue-400 rounded-2xl p-4 flex flex-col justify-between transition hover:shadow-md group"
                >
                  <div>
                    {/* Image & SKU Tag */}
                    <div
                      onClick={() => onOpenProductModal(product)}
                      className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-50 cursor-pointer"
                    >
                      <img
                        src={imageUrl}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute top-2 left-2 bg-slate-900/90 text-white px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                        SKU: {product.sku}
                      </div>
                      {product.featured && (
                        <div className="absolute top-2 right-2 bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded">
                          PROMO
                        </div>
                      )}
                    </div>

                    {/* Title & Info */}
                    <div className="pt-3">
                      <h3
                        onClick={() => onOpenProductModal(product)}
                        className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition cursor-pointer line-clamp-2"
                      >
                        {product.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                        {product.description || 'Garantía industrial de resistencia.'}
                      </p>
                    </div>
                  </div>

                  {/* Pricing & Add to Cart */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Precio Mayor / Detal</span>
                      <span className="text-lg font-black text-blue-900 font-mono">
                        ${product.price.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      {isOutOfStock ? (
                        <span className="text-xs text-rose-600 font-bold bg-rose-50 px-2.5 py-1 rounded-md">
                          Agotado
                        </span>
                      ) : hasOptions ? (
                        <button
                          onClick={() => onOpenProductModal(product)}
                          className="bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition"
                        >
                          Medidas / Opciones
                        </button>
                      ) : qty > 0 ? (
                        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-2 py-1">
                          <button
                            onClick={() => onAddToCart(product, qty - 1)}
                            className="w-5 h-5 flex items-center justify-center text-blue-800 hover:bg-blue-200/60 rounded"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-black text-blue-950 w-4 text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() => onAddToCart(product, qty + 1)}
                            className="w-5 h-5 flex items-center justify-center text-blue-800 hover:bg-blue-200/60 rounded"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onAddToCart(product, 1)}
                          className="bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-sm"
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

      {/* Floating Checkout Footer Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 z-40 max-w-lg mx-auto px-4 animate-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={onOpenCart}
            className="w-full bg-blue-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between hover:bg-blue-950 active:scale-[0.99] transition font-bold"
          >
            <div className="flex items-center gap-3">
              <span className="bg-amber-500 text-slate-950 text-xs px-2.5 py-1 rounded-md font-black">
                {cartCount} {cartCount === 1 ? 'artículo' : 'artículos'}
              </span>
              <span className="text-sm">Solicitar Cotización Inmediata</span>
            </div>
            <span className="text-base font-black text-amber-400 font-mono">${cartAmount.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, Wrench, ShieldCheck, Gauge, Plus, Minus, MessageCircle } from 'lucide-react';
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

export function ThemeMotoParts({
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 selection:bg-amber-400 selection:text-black pb-32">
      {/* Moto Pro Header */}
      <header className="sticky top-0 z-40 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-black flex items-center justify-center font-black text-lg shadow-md shadow-amber-400/10">
              <Gauge className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base tracking-tight text-white">{tenant.name}</h1>
                <span className="bg-amber-400/10 text-amber-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-amber-400/30">
                  REPUESTOS 100% ORIGINALES
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-mono hidden sm:block">
                {tenant.welcomeMessage || 'Catálogo de repuestos, lubricantes y accesorios para motos.'}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenCart}
            className="h-10 px-4 bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-lg shadow-amber-400/20 active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Pedido ({cartCount})</span>
            <span className="bg-black text-amber-400 text-[11px] font-mono px-2 py-0.5 rounded font-black">
              ${cartAmount.toFixed(2)}
            </span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* Search & Compatibility Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar por código de pieza, modelo (ej: DT, SBR, Keeway)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs placeholder:text-neutral-500 text-white focus:outline-none focus:border-amber-400 font-mono"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                    : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Technical Moto Parts Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center border border-neutral-800 rounded-2xl bg-neutral-900">
            <p className="text-neutral-500 text-sm font-mono">No se encontraron repuestos con este criterio.</p>
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
                'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80';

              return (
                <div
                  key={product.id}
                  className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-4 flex flex-col justify-between transition hover:shadow-xl group"
                >
                  <div>
                    {/* Image & SKU Tag */}
                    <div
                      onClick={() => onOpenProductModal(product)}
                      className="relative aspect-video w-full rounded-xl overflow-hidden bg-neutral-950 cursor-pointer"
                    >
                      <img
                        src={imageUrl}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute top-2 left-2 bg-black/85 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono font-bold text-amber-400 border border-neutral-800">
                        {product.sku}
                      </div>
                      {isOutOfStock ? (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-rose-400 font-mono text-xs font-bold uppercase tracking-wider bg-rose-950/80 px-3 py-1 rounded border border-rose-800">
                            Agotado
                          </span>
                        </div>
                      ) : (
                        <div className="absolute bottom-2 right-2 bg-emerald-950/80 text-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-800 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Garantizado
                        </div>
                      )}
                    </div>

                    {/* Title & Description */}
                    <div className="pt-3">
                      <h3
                        onClick={() => onOpenProductModal(product)}
                        className="font-bold text-sm text-white group-hover:text-amber-400 transition cursor-pointer line-clamp-2"
                      >
                        {product.title}
                      </h3>
                      <p className="text-xs text-neutral-400 line-clamp-2 mt-1 font-mono">
                        {product.description || 'Repuesto genuino de alta durabilidad.'}
                      </p>
                    </div>
                  </div>

                  {/* Pricing & Add Actions */}
                  <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-neutral-500 uppercase font-mono block">Precio Neto</span>
                      <span className="text-lg font-black text-amber-400 font-mono">
                        ${product.price.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      {isOutOfStock ? (
                        <span className="text-xs text-neutral-500 font-mono">Sin stock</span>
                      ) : hasOptions ? (
                        <button
                          onClick={() => onOpenProductModal(product)}
                          className="bg-neutral-800 hover:bg-neutral-700 text-white font-mono text-xs font-bold px-3.5 py-2 rounded-xl transition"
                        >
                          Variantes
                        </button>
                      ) : qty > 0 ? (
                        <div className="flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded-xl px-2 py-1">
                          <button
                            onClick={() => onAddToCart(product, qty - 1)}
                            className="w-5 h-5 flex items-center justify-center text-neutral-300 hover:text-white"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-mono font-black text-amber-400 w-4 text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() => onAddToCart(product, qty + 1)}
                            className="w-5 h-5 flex items-center justify-center text-neutral-300 hover:text-white"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onAddToCart(product, 1)}
                          className="bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs px-4 py-2 rounded-xl transition shadow-md shadow-amber-400/10 font-mono"
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
            className="w-full bg-amber-400 text-black p-4 rounded-2xl shadow-2xl flex items-center justify-between hover:bg-amber-300 active:scale-[0.99] transition font-mono font-bold"
          >
            <div className="flex items-center gap-3">
              <span className="bg-black text-amber-400 text-xs px-2.5 py-1 rounded-full">
                {cartCount} piezas
              </span>
              <span className="text-xs uppercase tracking-wider">Enviar Orden al Taller</span>
            </div>
            <span className="text-base font-black">${cartAmount.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

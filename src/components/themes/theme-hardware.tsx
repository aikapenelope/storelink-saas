'use client';

import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, Hammer, CheckCircle2, Plus, Minus, FileText, ChevronRight } from 'lucide-react';
import { DemosMartesSwitcher } from '@/components/demos-martes-switcher';
import { type ProductItem, type TenantConfig } from '@/components/storefront-client';

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

export function ThemeHardwareStore({
  tenant,
  products,
  categories,
  cartCount,
  cartAmount,
  cart,
  activeTheme = 'hardware-store',
  onSelectTheme = () => {},
  onOpenCart,
  onOpenProductModal,
  onAddToCart,
}: ThemeProps) {
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  const exchangeRate = tenant.exchangeRateVES || 910.0;
  const showVES = tenant.showVES ?? true;

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
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 pb-36 font-sans w-full max-w-full overflow-x-hidden">
      {/* 1. Contractor & Wholesale Top Strip */}
      <div className="bg-slate-950 text-slate-200 text-xs py-2 px-4 text-center font-bold flex items-center justify-center gap-3 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-amber-400" />
          <span>VENTAS AL MAYOR Y DETAL • SUMINISTROS & FERRETERÍA</span>
        </div>
        {showVES && (
          <span className="bg-slate-800 text-amber-400 px-2.5 py-0.5 rounded-full font-mono text-[10px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            TASA OFICIAL BINANCE P2P: {exchangeRate.toFixed(2)} Bs/$
          </span>
        )}
      </div>

      {/* 2. Ferretería Header */}
      <header className="sticky top-0 z-40 bg-blue-950 text-white shadow-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg sm:text-xl shadow-md border-2 border-amber-400 transform hover:scale-105 transition flex-shrink-0">
              <Hammer className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base sm:text-xl tracking-tight text-white truncate">{tenant.name}</h1>
                <span className="bg-blue-800/80 text-blue-200 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-600 flex-shrink-0">
                  PRO
                </span>
              </div>
              <p className="text-xs text-blue-200 hidden md:flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> Despacho Inmediato
                </span>
                <span>•</span>
                <span>Herramientas Manuales, Eléctricas & Plomería</span>
              </p>
            </div>
          </div>

          <button
            onClick={onOpenCart}
            className="h-10 sm:h-12 px-3 sm:px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-2xl transition flex items-center gap-2 shadow-lg active:scale-95 uppercase tracking-wider flex-shrink-0"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Cotizar</span>
            <span className="bg-slate-950 text-amber-400 text-xs px-2 py-0.5 rounded-lg font-mono font-black">
              ${cartAmount.toFixed(2)}
            </span>
          </button>
        </div>
      </header>

      {/* 3. Contractor Volume Promo Strip */}
      <section className="max-w-6xl mx-auto px-4 pt-6">
        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-blue-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md inline-block">
              Precios Especiales a Contratistas
            </span>
            <h2 className="text-lg sm:text-2xl font-black">Descuentos por Volumen a partir de 6 Unidades</h2>
            <p className="text-xs text-blue-200">Agrega tus herramientas a la lista y envía la cotización al WhatsApp de ventas.</p>
          </div>
          <div className="flex gap-2">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 text-center border border-white/15">
              <span className="block text-base sm:text-lg font-black text-amber-400">-15%</span>
              <span className="text-[9px] sm:text-[10px] text-blue-200 font-bold uppercase">Mayorista</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 text-center border border-white/15">
              <span className="block text-base sm:text-lg font-black text-emerald-400">100%</span>
              <span className="text-[9px] sm:text-[10px] text-blue-200 font-bold uppercase">Garantía</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Search & Category Filter (Contained for PWA) */}
      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6 w-full min-w-0 max-w-full overflow-hidden">
        <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 w-full min-w-0 max-w-full overflow-hidden">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar taladros, bombas, llaves, amoladoras, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-900 font-medium"
            />
          </div>

          <div className="w-full md:w-auto min-w-0 max-w-full overflow-x-auto no-scrollbar py-1">
            <div className="flex items-center gap-2 flex-nowrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-black transition whitespace-nowrap flex-shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-blue-950 text-white shadow-md'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 5. Industrial Hardware Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-24 text-center border border-slate-300 rounded-3xl bg-white">
            <p className="text-slate-400 text-sm font-bold">No hay herramientas registradas en esta sección.</p>
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

              const priceInVES = product.price * exchangeRate;

              return (
                <div
                  key={product.id}
                  className="bg-white border border-slate-200 hover:border-blue-700 rounded-3xl p-4 flex flex-col justify-between transition-all duration-300 hover:shadow-xl group"
                >
                  <div>
                    {/* Image & SKU Tag */}
                    <div
                      onClick={() => onOpenProductModal(product)}
                      className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-50 cursor-pointer"
                    >
                      <img
                        src={imageUrl}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute top-3 left-3 bg-slate-950/90 text-white px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold shadow-sm">
                        SKU: {product.sku}
                      </div>
                      {product.featured && (
                        <div className="absolute top-3 right-3 bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-lg shadow-sm">
                          OFERTA
                        </div>
                      )}
                    </div>

                    {/* Content Details */}
                    <div className="pt-4 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-blue-900 tracking-wider block">
                        {product.category?.name || 'Herramientas & Equipos'}
                      </span>
                      <h3
                        onClick={() => onOpenProductModal(product)}
                        className="font-black text-base text-slate-900 group-hover:text-blue-900 transition cursor-pointer line-clamp-1"
                      >
                        {product.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {product.description || 'Garantía industrial de alto rendimiento.'}
                      </p>
                    </div>
                  </div>

                  {/* Pricing & Add to Cart */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-blue-950 font-mono">
                          ${product.price.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold">USD</span>
                      </div>
                      {showVES && (
                        <span className="text-[11px] font-mono font-bold text-slate-500 block">
                          Bs. {priceInVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>

                    <div>
                      {isOutOfStock ? (
                        <span className="text-xs text-rose-600 font-bold bg-rose-50 px-3 py-1.5 rounded-lg">
                          Agotado
                        </span>
                      ) : hasOptions ? (
                        <button
                          onClick={() => onOpenProductModal(product)}
                          className="bg-blue-950 hover:bg-blue-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition"
                        >
                          Medidas / Opciones
                        </button>
                      ) : qty > 0 ? (
                        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-2.5 py-1.5">
                          <button
                            onClick={() => onAddToCart(product, qty - 1)}
                            className="w-6 h-6 flex items-center justify-center text-blue-900 hover:bg-blue-200/60 rounded-lg"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-black text-blue-950 w-5 text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() => onAddToCart(product, qty + 1)}
                            className="w-6 h-6 flex items-center justify-center text-blue-900 hover:bg-blue-200/60 rounded-lg"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onAddToCart(product, 1)}
                          className="bg-blue-950 hover:bg-blue-900 text-white font-black text-xs px-4 py-2.5 rounded-xl transition shadow-md active:scale-95"
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

      {/* 6. Floating Checkout Footer Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-16 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40 animate-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={onOpenCart}
            className="w-full bg-blue-950 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center justify-between hover:bg-black active:scale-[0.99] transition font-bold border border-blue-800"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="bg-amber-500 text-slate-950 text-xs px-2.5 py-1 rounded-full font-black flex-shrink-0">
                {cartCount}
              </span>
              <span className="text-xs sm:text-sm truncate">Solicitar Cotización</span>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-sm sm:text-base font-black text-amber-400 font-mono">${cartAmount.toFixed(2)}</span>
                <ChevronRight className="w-4 h-4 text-amber-400" />
              </div>
              {showVES && (
                <span className="text-[9px] sm:text-[10px] text-blue-200 block font-mono font-bold">
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

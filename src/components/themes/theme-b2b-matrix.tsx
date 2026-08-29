'use client';

import React, { useState, useMemo } from 'react';
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
  cart?: Array<{ id: string; quantity: number }>;
  onOpenCart: () => void;
  onOpenProductModal: (product: ProductItem) => void;
  onAddToCart: (product: ProductItem, quantity: number) => void;
}

export function ThemeB2BMatrix({
  tenant,
  products,
  categories,
  cartCount,
  cartAmount,
  cart = [],
  onOpenCart,
  onOpenProductModal,
  onAddToCart,
}: ThemeProps) {
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  const exchangeRate = tenant.exchangeRateVES || 0;
  const showVES = (tenant.showVES ?? true) && exchangeRate > 0;

  const getItemQty = (productId: string) => {
    const found = cart.find((item) => item.id === productId);
    return found ? found.quantity : 0;
  };

  const handleQtyChange = (product: ProductItem, delta: number) => {
    const current = getItemQty(product.id);
    const next = Math.max(0, current + delta);
    onAddToCart(product, next);
  };

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
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-36 font-sans w-full max-w-full overflow-x-hidden">
      {/* 0. Live Binance / Parallel Exchange Rate Top Strip */}
      {showVES && (
        <div className="bg-slate-950 text-slate-200 text-xs py-1.5 px-4 text-center font-bold flex items-center justify-center gap-2 border-b border-slate-800">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
          <span className="text-blue-400 font-extrabold">Tasa B2B / Mayorista:</span>
          <span className="font-mono bg-slate-800 text-white px-2 py-0.5 rounded text-[11px]">
            {exchangeRate.toFixed(2)} Bs/$
          </span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">• Cotización en tiempo real</span>
        </div>
      )}

      {/* 1. Enterprise Top Navigation */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-blue-600 rounded-xl text-white font-black text-xs sm:text-sm flex-shrink-0">
              B2B
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-base truncate">{tenant.name}</h1>
              <span className="text-[10px] sm:text-[11px] text-slate-400 block truncate">
                {tenant.welcomeMessage || 'Portal de Pedidos al Mayor'}
              </span>
            </div>
          </div>

          <button
            onClick={onOpenCart}
            className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-xs flex items-center gap-2 transition flex-shrink-0 shadow-sm active:scale-95"
            aria-label="Ver pedido B2B"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Pedido</span>
            <span className="bg-blue-800 px-2 py-0.5 rounded-full text-[11px] font-black">
              {cartCount}
            </span>
          </button>
        </div>
      </header>

      {/* 2. Control Bar: Search & Category Filter */}
      <div className="bg-white border-b border-slate-200 shadow-xs py-3 sticky top-14 sm:top-16 z-30">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por SKU, código o nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Main Content: Responsive Table on Desktop + Mobile Card List on Mobile */}
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* MOBILE CARD LIST (Phones) */}
        <div className="sm:hidden space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 p-6">
              No hay artículos disponibles con los filtros actuales.
            </div>
          ) : (
            filteredProducts.map((product) => {
              const qty = getItemQty(product.id);
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
                  className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      onClick={() => onOpenProductModal(product)}
                      className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 cursor-pointer"
                    >
                      <SafeProductImage
                        src={imageUrl}
                        alt={product.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-mono font-bold text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                          {product.sku}
                        </span>
                        {isOutOfStock ? (
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 font-bold rounded text-[9px]">
                            Agotado
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[9px]">
                            Stock
                          </span>
                        )}
                      </div>
                      <h3
                        onClick={() => onOpenProductModal(product)}
                        className="font-bold text-xs text-slate-900 leading-snug cursor-pointer line-clamp-2"
                      >
                        {product.title}
                      </h3>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="font-black text-sm text-blue-700">
                          ${product.price.toFixed(2)}
                        </span>
                        {showVES && (
                          <span className="font-mono text-[10px] text-slate-500 font-bold">
                            Bs. {priceVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quantity Stepper or Options Button */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {product.category?.name || 'General'}
                    </span>

                    {isOutOfStock ? (
                      <span className="text-xs text-slate-400 font-medium">No disponible</span>
                    ) : hasOptions ? (
                      <button
                        onClick={() => onOpenProductModal(product)}
                        className="px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold active:scale-95 transition"
                      >
                        Ver Opciones
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => handleQtyChange(product, -1)}
                          className="w-8 h-8 rounded-lg bg-white active:bg-slate-200 flex items-center justify-center shadow-xs text-slate-800 font-bold text-sm"
                          aria-label="Disminuir"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-black text-xs font-mono">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQtyChange(product, 1)}
                          className="w-8 h-8 rounded-lg bg-blue-600 text-white active:bg-blue-700 flex items-center justify-center shadow-xs font-bold text-sm"
                          aria-label="Aumentar"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP MATRIX TABLE (Tablets / Laptops) */}
        <div className="hidden sm:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">SKU</th>
                  <th className="py-3.5 px-4">Producto</th>
                  <th className="py-3.5 px-4">Categoría</th>
                  <th className="py-3.5 px-4">Disponibilidad</th>
                  <th className="py-3.5 px-4 text-right">Precio Unitario</th>
                  <th className="py-3.5 px-4 text-center">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No hay artículos disponibles con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const qty = getItemQty(product.id);
                    const isOutOfStock = product.stockStatus === 'out_of_stock';
                    const hasOptions =
                      (product.variants && product.variants.length > 0) ||
                      (product.modifiers && product.modifiers.length > 0);
                    const priceVES = showVES ? product.price * exchangeRate : 0;
                    const imageUrl =
                      product.images?.[0]?.url ||
                      DEFAULT_PRODUCT_IMAGE_URL;

                    return (
                      <tr key={product.id} className="hover:bg-blue-50/30 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-600">
                          {product.sku}
                        </td>
                        <td className="py-3.5 px-4">
                          <div
                            onClick={() => onOpenProductModal(product)}
                            className="cursor-pointer group flex items-center gap-3"
                          >
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                              <SafeProductImage
                                src={imageUrl}
                                alt={product.title}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 group-hover:text-blue-600 transition">
                                {product.title}
                              </p>
                              <p className="text-[11px] text-slate-400 line-clamp-1">
                                {product.description}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {product.category?.name || 'General'}
                        </td>
                        <td className="py-3.5 px-4">
                          {isOutOfStock ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-bold rounded text-[10px]">
                              Agotado
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                              En Stock
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-bold text-slate-900 text-sm block">
                            ${product.price.toFixed(2)}
                          </span>
                          {showVES && (
                            <span className="font-mono text-[10px] text-slate-500 font-medium block">
                              Bs. {priceVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {isOutOfStock ? (
                            <span className="text-center block text-slate-400">-</span>
                          ) : hasOptions ? (
                            <button
                              onClick={() => onOpenProductModal(product)}
                              className="mx-auto block px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold active:scale-95 transition"
                            >
                              Opciones
                            </button>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 bg-slate-100 border border-slate-300 rounded-lg p-1 w-28 mx-auto">
                              <button
                                onClick={() => handleQtyChange(product, -1)}
                                className="w-6 h-6 rounded bg-white hover:bg-slate-200 flex items-center justify-center shadow-xs text-slate-700 font-bold"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center font-bold text-xs font-mono">
                                {qty}
                              </span>
                              <button
                                onClick={() => handleQtyChange(product, 1)}
                                className="w-6 h-6 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center shadow-xs font-bold"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 4. Floating Checkout Footer Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-14 sm:bottom-4 left-0 right-0 z-40 max-w-xl mx-auto px-4 pointer-events-none">
          <button
            onClick={onOpenCart}
            className="pointer-events-auto w-full bg-slate-950 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-800 hover:bg-slate-900 active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-2.5">
              <span className="bg-blue-600 text-white text-xs font-black px-2.5 py-1 rounded-lg">
                {cartCount} {cartCount === 1 ? 'ítem' : 'ítems'}
              </span>
              <span className="font-bold text-xs sm:text-sm">Procesar Orden B2B</span>
            </div>
            <div className="text-right">
              <span className="text-sm sm:text-base font-black text-blue-400 block font-mono">
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

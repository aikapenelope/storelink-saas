'use client';

import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, Plus, Minus, FileText, CheckCircle2 } from 'lucide-react';
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

export function ThemeB2BMatrix({
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
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const handleQtyChange = (product: ProductItem, delta: number) => {
    const current = quantities[product.id] || 0;
    const next = Math.max(0, current + delta);
    setQuantities((prev) => ({ ...prev, [product.id]: next }));
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
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-32">
      {/* Enterprise Top Navigation */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white font-black text-sm">
              B2B
            </div>
            <div>
              <h1 className="font-bold text-base">{tenant.name}</h1>
              <span className="text-[11px] text-slate-400">Portal de Pedidos al Mayor</span>
            </div>
          </div>

          <button
            onClick={onOpenCart}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-xs flex items-center gap-2 transition"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Ver Pedido ({cartCount})</span>
            <span className="bg-blue-800 px-2 py-0.5 rounded text-[11px]">
              ${cartAmount.toFixed(2)}
            </span>
          </button>
        </div>
      </header>

      {/* Control Bar: Search and Category Filter */}
      <div className="bg-white border-b border-slate-200 shadow-sm py-4">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por SKU, código o nombre de producto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Matrix View */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Disponibilidad</th>
                  <th className="py-3 px-4 text-right">Precio Unitario</th>
                  <th className="py-3 px-4 text-center">Cantidad</th>
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
                    const qty = quantities[product.id] || 0;
                    const isOutOfStock = product.stockStatus === 'out_of_stock';
                    const hasOptions = (product.variants && product.variants.length > 0) || (product.modifiers && product.modifiers.length > 0);

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
                            <img
                              src={
                                product.images?.[0]?.url ||
                                'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'
                              }
                              alt={product.title}
                              className="w-10 h-10 rounded-lg object-cover bg-slate-100 flex-shrink-0"
                            />
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
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 text-sm">
                          ${product.price.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4">
                          {isOutOfStock ? (
                            <span className="text-center block text-slate-400">-</span>
                          ) : hasOptions ? (
                            <button
                              onClick={() => onOpenProductModal(product)}
                              className="mx-auto block px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] font-bold"
                            >
                              Opciones
                            </button>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 bg-slate-100 border border-slate-300 rounded-lg p-1 w-28 mx-auto">
                              <button
                                onClick={() => handleQtyChange(product, -1)}
                                className="w-6 h-6 rounded bg-white hover:bg-slate-200 flex items-center justify-center shadow-xs"
                              >
                                <Minus className="w-3 h-3 text-slate-700" />
                              </button>
                              <span className="w-8 text-center font-bold text-xs">
                                {qty}
                              </span>
                              <button
                                onClick={() => handleQtyChange(product, 1)}
                                className="w-6 h-6 rounded bg-white hover:bg-slate-200 flex items-center justify-center shadow-xs"
                              >
                                <Plus className="w-3 h-3 text-slate-700" />
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

      {/* Floating Checkout Footer Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 left-0 right-0 z-40 max-w-xl mx-auto px-4">
          <button
            onClick={onOpenCart}
            className="w-full bg-slate-950 text-white p-4 rounded-xl shadow-2xl flex items-center justify-between border border-slate-800 hover:bg-slate-900 active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3">
              <span className="bg-blue-500 text-white text-xs font-bold px-2.5 py-1 rounded-md">
                {cartCount} {cartCount === 1 ? 'ítem' : 'ítems'}
              </span>
              <span className="font-bold text-sm">Procesar Orden de Compra</span>
            </div>
            <span className="text-base font-black text-blue-400">${cartAmount.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

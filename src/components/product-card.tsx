'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Plus, Minus, Check, ShoppingBag, Eye } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { DEFAULT_PRODUCT_IMAGE_URL } from '@/lib/constants';

export interface ProductItem {
  id: string;
  sku: string;
  title: string;
  price: number;
  description?: string;
  images?: Array<{ url: string; alt?: string }>;
  category?: { id: string; name: string };
  stockStatus: 'in_stock' | 'out_of_stock';
  featured?: boolean;
  /** Nombres de las opciones de modificadores seleccionadas (las valida el servidor) */
  selectedModifiers?: string[];
}

interface ProductCardProps {
  product: ProductItem;
  currency?: string;
  onAddToCart: (product: ProductItem, quantity: number) => void;
  cartQuantity?: number;
}

export function ProductCard({ product, currency = 'USD', onAddToCart, cartQuantity = 0 }: ProductCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isOutOfStock = product.stockStatus === 'out_of_stock';
  const imageUrl = product.images?.[0]?.url || DEFAULT_PRODUCT_IMAGE_URL;

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between group">
        {/* Product Image */}
        <div
          className="relative aspect-square w-full bg-slate-100 overflow-hidden cursor-pointer"
          onClick={() => setIsModalOpen(true)}
        >
          <Image
            src={imageUrl}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
          {product.featured && (
            <span className="absolute top-2.5 left-2.5 bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
              Destacado
            </span>
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center">
              <span className="bg-red-500 text-white font-bold text-xs uppercase px-3 py-1 rounded-full shadow">
                Agotado
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(true);
            }}
            className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur shadow flex items-center justify-center text-slate-700 opacity-0 group-hover:opacity-100 transition"
            aria-label="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5 sm:p-4 flex flex-col flex-1 justify-between gap-3">
          <div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3
                className="font-bold text-slate-900 text-sm sm:text-base line-clamp-2 hover:text-green-600 transition cursor-pointer"
                onClick={() => setIsModalOpen(true)}
              >
                {product.title}
              </h3>
            </div>
            {product.description && (
              <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed">
                {product.description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div>
              <span className="text-xs text-slate-400 font-mono block">SKU: {product.sku}</span>
              <span className="text-base sm:text-lg font-black text-slate-900">
                {formatPrice(product.price, currency)}
              </span>
            </div>

            {/* Add to Cart Actions */}
            {isOutOfStock ? (
              <button
                disabled
                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed"
              >
                Sin Stock
              </button>
            ) : cartQuantity > 0 ? (
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => onAddToCart(product, cartQuantity - 1)}
                  className="w-7 h-7 rounded-lg bg-white text-green-700 flex items-center justify-center hover:bg-green-100 transition shadow-sm font-bold"
                  aria-label="Disminuir"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-5 text-center text-xs font-black text-green-800">
                  {cartQuantity}
                </span>
                <button
                  type="button"
                  onClick={() => onAddToCart(product, cartQuantity + 1)}
                  className="w-7 h-7 rounded-lg bg-green-600 text-white flex items-center justify-center hover:bg-green-700 transition shadow-sm font-bold"
                  aria-label="Aumentar"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onAddToCart(product, 1)}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl transition shadow-sm shadow-green-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Detail View */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="relative aspect-video w-full bg-slate-100">
              <Image
                src={imageUrl}
                alt={product.title}
                fill
                sizes="(max-width: 640px) 100vw, 512px"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-900/60 text-white flex items-center justify-center font-bold hover:bg-slate-900 transition"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between gap-4 mb-2">
                <h2 className="text-xl font-bold text-slate-900">{product.title}</h2>
                <span className="text-xl font-black text-green-600">
                  {formatPrice(product.price, currency)}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mb-4">Código SKU: {product.sku}</p>
              {product.description && (
                <p className="text-slate-600 text-sm leading-relaxed mb-6 whitespace-pre-line">
                  {product.description}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() => {
                    onAddToCart(product, cartQuantity > 0 ? cartQuantity + 1 : 1);
                    setIsModalOpen(false);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition shadow-lg shadow-green-600/25"
                >
                  <ShoppingBag className="w-5 h-5" />
                  {isOutOfStock ? 'Producto Agotado' : 'Agregar al Carrito'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

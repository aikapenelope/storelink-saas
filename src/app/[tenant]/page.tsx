'use client';

import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, MessageCircle, Store, Tag } from 'lucide-react';
import { ProductCard, ProductItem } from '@/components/product-card';
import { CartDrawer, CartItem } from '@/components/cart-drawer';
import { formatPrice } from '@/lib/utils';

// Sample demo data used when initializing or showcasing the store
const DEMO_PRODUCTS: ProductItem[] = [
  {
    id: '1',
    sku: 'PIZ-001',
    title: 'Pizza Margarita Artesanal',
    price: 12.5,
    description: 'Salsa de tomate San Marzano, mozzarella fresca di bufala, albahaca y aceite de oliva virgen extra.',
    category: { id: 'c1', name: 'Pizzas' },
    stockStatus: 'in_stock',
    featured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80' }],
  },
  {
    id: '2',
    sku: 'PIZ-002',
    title: 'Pizza Cuatro Quesos',
    price: 14.0,
    description: 'Mozzarella, gorgonzola, parmesano reggiano y queso de cabra con toque de orégano.',
    category: { id: 'c1', name: 'Pizzas' },
    stockStatus: 'in_stock',
    images: [{ url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80' }],
  },
  {
    id: '3',
    sku: 'BEB-001',
    title: 'Coca-Cola Original 1.5L',
    price: 3.5,
    description: 'Bebida gaseosa refrescante bien fría.',
    category: { id: 'c2', name: 'Bebidas' },
    stockStatus: 'in_stock',
    images: [{ url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80' }],
  },
  {
    id: '4',
    sku: 'POS-001',
    title: 'Tiramisú Tradicional Italiano',
    price: 5.5,
    description: 'Bizcocho savoiardi bañado en espresso, crema de mascarpone y cacao puro.',
    category: { id: 'c3', name: 'Postres' },
    stockStatus: 'in_stock',
    featured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=600&q=80' }],
  },
];

const DEMO_CATEGORIES = ['Todos', 'Pizzas', 'Bebidas', 'Postres'];

export default function TenantStorefrontPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Unwrapped params for Next.js 15
  const unwrappedParams = React.use(params);
  const tenantSlug = unwrappedParams.tenant || 'demo';

  // Format Store Name from slug (e.g. don-luigi -> Don Luigi)
  const storeName = tenantSlug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const whatsappPhone = '34600123456'; // Default demo phone (configurable per tenant)
  const currency = 'USD';

  // Cart Handlers
  const handleAddToCart = (product: ProductItem, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        return prev.filter((item) => item.id !== product.id);
      }
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) => (item.id === product.id ? { ...item, quantity } : item));
      }
      return [...prev, { ...product, quantity }];
    });
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        return prev.filter((item) => item.id !== productId);
      }
      return prev.map((item) => (item.id === productId ? { ...item, quantity } : item));
    });
  };

  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalCartAmount = cart.reduce((acc, item) => acc + item.quantity * item.price, 0);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return DEMO_PRODUCTS.filter((product) => {
      const matchesCategory =
        selectedCategory === 'Todos' || product.category?.name === selectedCategory;
      const matchesSearch =
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Top Header / Branding */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-green-600 flex items-center justify-center text-white shadow-md shadow-green-600/20 font-black">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-slate-900 text-base sm:text-lg leading-tight">
                {storeName}
              </h1>
              <div className="flex items-center gap-1.5 text-xs text-green-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>Abierto • Pedidos por WhatsApp</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 transition text-slate-700"
            aria-label="Ver carrito"
          >
            <ShoppingBag className="w-5 h-5" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-green-600 text-white font-black text-[11px] w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                {totalCartCount}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="max-w-4xl mx-auto px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar productos o SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-100/80 border border-transparent focus:border-green-500 focus:bg-white text-sm focus:outline-none transition"
            />
          </div>
        </div>

        {/* Category Pills (Horizontal Scroll) */}
        <div className="border-t border-slate-100 overflow-x-auto no-scrollbar">
          <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-2">
            {DEMO_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Product Catalog Grid */}
      <main className="max-w-4xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-slate-400" />
            <h2 className="font-black text-slate-800 text-base sm:text-lg">
              {selectedCategory === 'Todos' ? 'Todos los Productos' : selectedCategory}
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-semibold">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'}
          </span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 p-8">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700 text-base mb-1">No se encontraron productos</h3>
            <p className="text-slate-400 text-xs">Intenta con otra búsqueda o categoría.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {filteredProducts.map((product) => {
              const cartItem = cart.find((i) => i.id === product.id);
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  currency={currency}
                  cartQuantity={cartItem?.quantity || 0}
                  onAddToCart={handleAddToCart}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar (Mobile-First) */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto z-40 animate-in slide-in-from-bottom duration-200">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white p-4 rounded-2xl shadow-2xl shadow-green-600/40 flex items-center justify-between transition group"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center font-black text-xs">
                {totalCartCount}
              </div>
              <div className="text-left">
                <p className="text-xs font-medium text-green-100">Ver Carrito</p>
                <p className="text-sm font-black tracking-tight">
                  {formatPrice(totalCartAmount, currency)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 font-bold text-sm bg-white text-green-800 px-3.5 py-1.5 rounded-xl shadow-sm group-hover:translate-x-0.5 transition">
              <span>Continuar</span>
              <MessageCircle className="w-4 h-4 text-green-600" />
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        currency={currency}
        storeName={storeName}
        whatsappPhone={whatsappPhone}
        tenantSlug={tenantSlug}
        onUpdateQuantity={handleUpdateQuantity}
        onClearCart={() => setCart([])}
      />
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import { ShoppingBag, Check, Layers } from 'lucide-react';
import { CartDrawer, type CartItem } from './cart-drawer';
import { ThemeBasicBanner } from './themes/theme-basic';
import { ThemeFoodDelivery } from './themes/theme-food';
import { ThemeFashionBoutique } from './themes/theme-fashion';
import { ThemeMotoParts } from './themes/theme-moto';
import { ThemeHardwareStore } from './themes/theme-hardware';

export interface ProductVariant {
  name: string;
  sku?: string;
  price: number;
  stockStatus: 'in_stock' | 'out_of_stock';
}

export interface ProductModifierOption {
  name: string;
  priceDelta?: number;
}

export interface ProductModifierGroup {
  groupName: string;
  required?: boolean;
  options: ProductModifierOption[];
}

export interface ProductItem {
  id: string;
  sku: string;
  title: string;
  price: number;
  description?: string;
  category?: {
    id: string;
    name: string;
  };
  stockStatus: 'in_stock' | 'out_of_stock';
  trackStock?: boolean;
  stockQuantity?: number;
  featured?: boolean;
  images?: Array<{ url: string }>;
  variants?: ProductVariant[];
  modifiers?: ProductModifierGroup[];
}

export interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  theme?: 'basic-banner' | 'food-delivery' | 'fashion-boutique' | 'moto-parts' | 'hardware-store' | string;
  whatsappPhone: string;
  currency?: string;
  showVES?: boolean;
  exchangeRateVES?: number;
  primaryColor?: string;
  welcomeMessage?: string;
}

interface StorefrontClientProps {
  tenant: TenantConfig;
  products: ProductItem[];
  categories: string[];
}

// Curated Pure Industry Datasets for Live Preview
const VERTICAL_PRODUCTS: Record<string, { name: string; welcome: string; categories: string[]; items: ProductItem[] }> = {
  'basic-banner': {
    name: 'Comercial & Variedades Express',
    welcome: 'Catálogo de productos destacados con atención y pedidos directos por WhatsApp.',
    categories: ['Todos', 'Ofertas', 'Hogar', 'Tecnología', 'Cuidado Personal'],
    items: [
      {
        id: 'b1',
        sku: 'BAS-HOG-01',
        title: 'Lámpara LED de Escritorio Recargable Touch',
        price: 15.0,
        description: '3 niveles de intensidad de luz blanca/cálida, cuello flexible y batería USB.',
        category: { id: 'c1', name: 'Hogar' },
        stockStatus: 'in_stock',
        featured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'b2',
        sku: 'BAS-TEC-02',
        title: 'Auriculares Inalámbricos Bluetooth 5.3 con Estuche',
        price: 22.0,
        description: 'Cancelación pasiva de ruido, micrófono HD y hasta 24h de reproducción.',
        category: { id: 'c2', name: 'Tecnología' },
        stockStatus: 'in_stock',
        featured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'b3',
        sku: 'BAS-PER-03',
        title: 'Termo de Acero Inoxidable Doble Pared 750ml',
        price: 12.5,
        description: 'Mantiene bebidas frías por 24h y calientes por 12h. Tapa antiderrame.',
        category: { id: 'c3', name: 'Cuidado Personal' },
        stockStatus: 'in_stock',
        featured: false,
        images: [{ url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'b4',
        sku: 'BAS-OFR-04',
        title: 'Organizador Multiusos de Acrílico Transparente',
        price: 9.0,
        description: 'Ideal para cosméticos, escritorio o accesorios. 4 compartimientos.',
        category: { id: 'c4', name: 'Ofertas' },
        stockStatus: 'in_stock',
        featured: false,
        images: [{ url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80' }],
      },
    ],
  },
  'food-delivery': {
    name: 'Don Luigi & Burgers',
    welcome: 'Comida artesanal preparada al momento. Pide y recibe por WhatsApp.',
    categories: ['Todos', 'Hamburguesas', 'Pizzas', 'Pastas', 'Bebidas', 'Postres'],
    items: [
      {
        id: 'f1',
        sku: 'BUR-001',
        title: 'Smash Burger Doble con Cheddar',
        price: 9.5,
        description: 'Doble carne angus 180g, queso cheddar fundido, cebolla caramelizada y salsa especial.',
        category: { id: 'c1', name: 'Hamburguesas' },
        stockStatus: 'in_stock',
        featured: true,
        variants: [
          { name: 'Simple (1 carne)', sku: 'BUR-001-S', price: 7.5, stockStatus: 'in_stock' },
          { name: 'Doble (2 carnes)', sku: 'BUR-001-D', price: 9.5, stockStatus: 'in_stock' },
          { name: 'Triple (3 carnes)', sku: 'BUR-001-T', price: 12.0, stockStatus: 'in_stock' },
        ],
        modifiers: [
          {
            groupName: 'Extras irresistibles',
            options: [
              { name: 'Bacon Ahumado Crujiente', priceDelta: 1.5 },
              { name: 'Huevo a la Plancha', priceDelta: 1.0 },
              { name: 'Papas Fritas Medianas', priceDelta: 2.5 },
            ],
          },
        ],
        images: [{ url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'f2',
        sku: 'PIZ-001',
        title: 'Pizza Margarita Artesanal Napolitana',
        price: 12.5,
        description: 'Tomates San Marzano, mozzarella fresca di bufala, albahaca y aceite de oliva virgen extra.',
        category: { id: 'c2', name: 'Pizzas' },
        stockStatus: 'in_stock',
        featured: true,
        variants: [
          { name: 'Mediana (6 porciones)', sku: 'PIZ-001-M', price: 12.5, stockStatus: 'in_stock' },
          { name: 'Familiar (8 porciones)', sku: 'PIZ-001-L', price: 16.0, stockStatus: 'in_stock' },
        ],
        images: [{ url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'f3',
        sku: 'PAS-001',
        title: 'Fettuccine Alfredo con Trufa Negra',
        price: 13.5,
        description: 'Pasta fresca al huevo con crema de mantequilla trufada y queso parmesano Reggiano.',
        category: { id: 'c3', name: 'Pastas' },
        stockStatus: 'in_stock',
        featured: false,
        images: [{ url: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'f4',
        sku: 'BEB-001',
        title: 'Limonada de Coco Frappé',
        price: 4.0,
        description: 'Limón fresco batido con leche de coco cremosa y hielo.',
        category: { id: 'c4', name: 'Bebidas' },
        stockStatus: 'in_stock',
        featured: false,
        images: [{ url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80' }],
      },
    ],
  },
  'fashion-boutique': {
    name: 'AURA Studio & Apparel',
    welcome: 'Prendas exclusivas, cortes contemporáneos y tejidos orgánicos sostenibles.',
    categories: ['Todos', 'Camisetas', 'Vestidos', 'Chaquetas', 'Pantalones', 'Hoodies', 'Sneakers'],
    items: [
      {
        id: 'fa1',
        sku: 'AUR-TOP-01',
        title: 'Camiseta Heavyweight Minimalist 260GSM',
        price: 28.0,
        description: 'Algodón orgánico peinado de alto gramaje con corte boxy fit estructurado.',
        category: { id: 'c1', name: 'Camisetas' },
        stockStatus: 'in_stock',
        featured: true,
        variants: [
          { name: 'Talla S - Negro Mate', sku: 'AUR-01-S', price: 28.0, stockStatus: 'in_stock' },
          { name: 'Talla M - Negro Mate', sku: 'AUR-01-M', price: 28.0, stockStatus: 'in_stock' },
          { name: 'Talla L - Negro Mate', sku: 'AUR-01-L', price: 28.0, stockStatus: 'in_stock' },
          { name: 'Talla XL - Negro Mate', sku: 'AUR-01-XL', price: 28.0, stockStatus: 'in_stock' },
        ],
        images: [{ url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'fa2',
        sku: 'AUR-VES-02',
        title: 'Vestido Midi de Lino Natural Estructurado',
        price: 65.0,
        description: 'Lino 100% transpirable con escote cruzado y lazada ajustable en cintura.',
        category: { id: 'c2', name: 'Vestidos' },
        stockStatus: 'in_stock',
        featured: true,
        variants: [
          { name: 'Talla S - Blanco Crudo', sku: 'AUR-V02-S', price: 65.0, stockStatus: 'in_stock' },
          { name: 'Talla M - Blanco Crudo', sku: 'AUR-V02-M', price: 65.0, stockStatus: 'in_stock' },
          { name: 'Talla L - Blanco Crudo', sku: 'AUR-V02-L', price: 65.0, stockStatus: 'in_stock' },
        ],
        images: [{ url: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'fa3',
        sku: 'AUR-JKT-03',
        title: 'Chaqueta Denim Vintage Washed Oversized',
        price: 85.0,
        description: 'Denim resistente con botones metálicos envejecidos y forro interior suave.',
        category: { id: 'c3', name: 'Chaquetas' },
        stockStatus: 'in_stock',
        featured: false,
        variants: [
          { name: 'Talla M', sku: 'AUR-J03-M', price: 85.0, stockStatus: 'in_stock' },
          { name: 'Talla L', sku: 'AUR-J03-L', price: 85.0, stockStatus: 'in_stock' },
        ],
        images: [{ url: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'fa4',
        sku: 'AUR-PNT-04',
        title: 'Pantalón Pleated Wide Leg en Gabardina',
        price: 45.0,
        description: 'Corte amplio con pinzas frontales y caída fluida contemporánea.',
        category: { id: 'c4', name: 'Pantalones' },
        stockStatus: 'in_stock',
        featured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'fa5',
        sku: 'AUR-HOD-05',
        title: 'Hoodie Fleece Premium 450GSM',
        price: 55.0,
        description: 'Capucha doble forrada sin cordones, bolsillo canguro y felpa interior suave.',
        category: { id: 'c5', name: 'Hoodies' },
        stockStatus: 'in_stock',
        featured: false,
        images: [{ url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'fa6',
        sku: 'AUR-SNK-06',
        title: 'Sneakers Minimalist Cuero Blanco',
        price: 75.0,
        description: 'Piel vacuna seleccionada, suela cosida antideslizante y plantilla anatómica.',
        category: { id: 'c6', name: 'Sneakers' },
        stockStatus: 'in_stock',
        featured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80' }],
      },
    ],
  },
  'moto-parts': {
    name: 'MotoRepuestos El Piloto Pro',
    welcome: 'Repuestos genuinos, cilindros, kits de tracción, cascos y lubricantes para motos.',
    categories: ['Todos', 'Motor & Cilindros', 'Frenos & Discos', 'Transmisión', 'Lubricantes', 'Cascos & Seguridad', 'Carburadores'],
    items: [
      {
        id: 'm1',
        sku: 'MOT-CIL-150',
        title: 'Kit de Cilindro y Pistón Completo 150cc',
        price: 42.0,
        description: 'Compatible con Empire Horse, Owen, Bera SBR y matrices CG150. Incluye aros y pasador.',
        category: { id: 'c1', name: 'Motor & Cilindros' },
        stockStatus: 'in_stock',
        featured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'm2',
        sku: 'MOT-FRE-CER',
        title: 'Pastillas de Freno Cerámicas de Alto Rendimiento',
        price: 14.5,
        description: 'Compuesto cerámico de frenado en frío/calor sin desgaste prematuro del disco.',
        category: { id: 'c2', name: 'Frenos & Discos' },
        stockStatus: 'in_stock',
        featured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'm3',
        sku: 'MOT-TRX-428',
        title: 'Cadena Reforzada O-Ring 428H-128L Dorada',
        price: 22.0,
        description: 'Acero templado con retenes O-Ring antiestiramiento y eslabón de unión rápido.',
        category: { id: 'c3', name: 'Transmisión' },
        stockStatus: 'in_stock',
        featured: false,
        images: [{ url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'm4',
        sku: 'MOT-LUB-10W40',
        title: 'Aceite 4T 10W-40 Full Sintético 1 Litro',
        price: 12.0,
        description: 'Norma JASO MA2 / API SN para máxima protección de embrague y caja de cambios.',
        category: { id: 'c4', name: 'Lubricantes' },
        stockStatus: 'in_stock',
        featured: false,
        images: [{ url: 'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'm5',
        sku: 'MOT-CAS-DOT',
        title: 'Casco Integral Certificado DOT con Visor Anti-Fog',
        price: 75.0,
        description: 'Carcasa de policarbonato reforzado, ventilación aerodinámica y cierre micrométrico.',
        category: { id: 'c5', name: 'Cascos & Seguridad' },
        stockStatus: 'in_stock',
        featured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'm6',
        sku: 'MOT-CRB-28MM',
        title: 'Carburador Racing Mikuni Tipo Cortina Plana 28mm',
        price: 38.0,
        description: 'Mayor flujo de aire y respuesta instantánea al acelerador para motores 150cc a 200cc.',
        category: { id: 'c6', name: 'Carburadores' },
        stockStatus: 'in_stock',
        featured: false,
        images: [{ url: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=600&q=80' }],
      },
    ],
  },
  'hardware-store': {
    name: 'Ferretería & Suministros El Maestro',
    welcome: 'Herramientas eléctricas, manuales, plomería y construcción con cotización al WhatsApp.',
    categories: ['Todos', 'Herramientas Eléctricas', 'Herramientas Manuales', 'Plomería & Bombas', 'Maquinaria & Sierras', 'Cajas & Almacenaje'],
    items: [
      {
        id: 'h1',
        sku: 'FER-TAL-20V',
        title: 'Taladro Percutor Inalámbrico Brushless 20V + 2 Baterías',
        price: 89.0,
        description: 'Motor sin escobillas, 60 Nm de torque, mandril metálico 1/2" y maletín rígido.',
        category: { id: 'c1', name: 'Herramientas Eléctricas' },
        stockStatus: 'in_stock',
        featured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'h2',
        sku: 'FER-LLV-12P',
        title: 'Juego de Llaves Combinadas Cromo Vanadio (8mm a 24mm)',
        price: 28.5,
        description: 'Set de 12 llaves pulidas espejo con estuche de lona enrollable resistente.',
        category: { id: 'c2', name: 'Herramientas Manuales' },
        stockStatus: 'in_stock',
        featured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'h3',
        sku: 'FER-AMO-850',
        title: 'Amoladora Angular 4-1/2" 850W con Guarda Rápida',
        price: 45.0,
        description: '11.000 RPM, mango auxiliar ergonómico y sistema de disipación de polvo.',
        category: { id: 'c1', name: 'Herramientas Eléctricas' },
        stockStatus: 'in_stock',
        featured: false,
        images: [{ url: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'h4',
        sku: 'FER-BOM-05HP',
        title: 'Bomba de Agua Periférica 1/2 HP 110V',
        price: 36.0,
        description: 'Impulsor de bronce, altura máxima 35 metros y caudal de 35 L/min.',
        category: { id: 'c3', name: 'Plomería & Bombas' },
        stockStatus: 'in_stock',
        featured: false,
        images: [{ url: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'h5',
        sku: 'FER-SIE-714',
        title: 'Sierra Circular de Mano 7-1/4" 1500W con Disco',
        price: 68.0,
        description: 'Corte a 45° y 90°, base de aluminio graduada y guía láser de precisión.',
        category: { id: 'c4', name: 'Maquinaria & Sierras' },
        stockStatus: 'in_stock',
        featured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80' }],
      },
      {
        id: 'h6',
        sku: 'FER-CAJ-MET',
        title: 'Caja de Herramientas Metálica Cantilever 3 Niveles',
        price: 32.0,
        description: 'Estructura en chapa de acero galvanizado con 5 compartimientos desplegables.',
        category: { id: 'c5', name: 'Cajas & Almacenaje' },
        stockStatus: 'in_stock',
        featured: false,
        images: [{ url: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=600&q=80' }],
      },
    ],
  },
};

export function StorefrontClient({
  tenant,
  products,
  categories,
}: StorefrontClientProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Active theme (defaults to tenant.theme, allows live preview toggle)
  const [activeTheme, setActiveTheme] = useState<string>(tenant.theme || 'basic-banner');

  // Modal variant & modifier selection state
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, ProductModifierOption>>({});

  const handleOpenProductModal = (product: ProductItem) => {
    setSelectedProduct(product);
    setSelectedVariant(product.variants && product.variants.length > 0 ? product.variants[0] : null);
    setSelectedModifiers({});
  };

  const currentModalPrice = useMemo(() => {
    if (!selectedProduct) return 0;
    let base = selectedVariant ? selectedVariant.price : selectedProduct.price;
    Object.values(selectedModifiers).forEach((mod) => {
      if (mod.priceDelta) base += mod.priceDelta;
    });
    return base;
  }, [selectedProduct, selectedVariant, selectedModifiers]);

  const handleAddToCart = (product: ProductItem, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        return prev.filter((item) => item.id !== product.id);
      }
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) => (item.id === product.id ? { ...item, quantity } : item));
      }
      return [
        ...prev,
        {
          ...product,
          quantity,
        },
      ];
    });
  };

  const handleAddCustomizedToCart = () => {
    if (!selectedProduct) return;

    const modLabels = Object.values(selectedModifiers).map((m) => m.name);
    const variantLabel = selectedVariant ? selectedVariant.name : '';
    const customizations = [variantLabel, ...modLabels].filter(Boolean).join(', ');

    const finalTitle = customizations
      ? `${selectedProduct.title} (${customizations})`
      : selectedProduct.title;

    const finalSku = selectedVariant?.sku || selectedProduct.sku;
    const finalId = `${selectedProduct.id}-${customizations.replace(/\s+/g, '-').toLowerCase() || 'base'}`;

    const customizedItem: ProductItem = {
      ...selectedProduct,
      id: finalId,
      sku: finalSku,
      title: finalTitle,
      price: currentModalPrice,
    };

    handleAddToCart(customizedItem, 1);
    setSelectedProduct(null);
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

  // Active theme dataset (switches products when clicking demo verticals)
  const currentVertical = VERTICAL_PRODUCTS[activeTheme] || VERTICAL_PRODUCTS['basic-banner'];
  
  // If products are the initial demo food set OR user switches vertical in preview:
  const isCustomDbProducts = products.length > 0 && !products.some((p) => p.sku === 'PIZ-001');
  const activeProducts = (isCustomDbProducts && activeTheme === tenant.theme) ? products : currentVertical.items;
  const activeCategories = (isCustomDbProducts && activeTheme === tenant.theme) ? categories : currentVertical.categories;

  const activeTenantConfig: TenantConfig = {
    ...tenant,
    name: (isCustomDbProducts && activeTheme === tenant.theme) ? tenant.name : currentVertical.name,
    welcomeMessage: (isCustomDbProducts && activeTheme === tenant.theme) ? tenant.welcomeMessage : currentVertical.welcome,
    exchangeRateVES: tenant.exchangeRateVES || 910.0,
    showVES: tenant.showVES ?? true,
  };

  const themeProps = {
    tenant: activeTenantConfig,
    products: activeProducts,
    categories: activeCategories,
    cartCount: totalCartCount,
    cartAmount: totalCartAmount,
    cart,
    activeTheme,
    onSelectTheme: (themeId: string) => setActiveTheme(themeId),
    onOpenCart: () => setIsCartOpen(true),
    onOpenProductModal: handleOpenProductModal,
    onAddToCart: handleAddToCart,
  };

  return (
    <div className="relative min-h-screen">
      {/* Render Active Theme View */}
      {activeTheme === 'basic-banner' && <ThemeBasicBanner {...themeProps} />}
      {activeTheme === 'fashion-boutique' && <ThemeFashionBoutique {...themeProps} />}
      {activeTheme === 'moto-parts' && <ThemeMotoParts {...themeProps} />}
      {activeTheme === 'hardware-store' && <ThemeHardwareStore {...themeProps} />}
      {activeTheme === 'food-delivery' && <ThemeFoodDelivery {...themeProps} />}

      {/* Shared Interactive Product Customizer Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-white text-slate-900 rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-6 duration-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image Banner */}
            <div className="relative h-56 bg-slate-100 flex-shrink-0">
              <img
                src={
                  selectedProduct.images?.[0]?.url ||
                  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'
                }
                alt={selectedProduct.title}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  SKU: {selectedVariant?.sku || selectedProduct.sku}
                </span>
                <span className="text-xl font-black text-emerald-700">
                  ${currentModalPrice.toFixed(2)}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedProduct.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed mt-1">
                  {selectedProduct.description || 'Sin descripción detallada.'}
                </p>
              </div>

              {/* Variants Section */}
              {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Selecciona una opción / Tamaño:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedProduct.variants.map((v) => {
                      const isSelected = selectedVariant?.name === v.name;
                      return (
                        <button
                          key={v.name}
                          onClick={() => setSelectedVariant(v)}
                          className={`p-2.5 rounded-xl border text-left flex justify-between items-center transition ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 ring-1 ring-emerald-600'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold">{v.name}</p>
                            <p className="text-[11px] text-slate-500">${v.price.toFixed(2)}</p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modifiers Section */}
              {selectedProduct.modifiers && selectedProduct.modifiers.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  {selectedProduct.modifiers.map((group) => (
                    <div key={group.groupName} className="space-y-2">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                        {group.groupName}:
                      </label>
                      <div className="space-y-1.5">
                        {group.options.map((opt) => {
                          const isSelected = selectedModifiers[group.groupName]?.name === opt.name;
                          return (
                            <button
                              key={opt.name}
                              onClick={() => {
                                setSelectedModifiers((prev) => {
                                  if (isSelected) {
                                    const next = { ...prev };
                                    delete next[group.groupName];
                                    return next;
                                  }
                                  return { ...prev, [group.groupName]: opt };
                                });
                              }}
                              className={`w-full p-2.5 rounded-xl border text-left flex justify-between items-center transition ${
                                isSelected
                                  ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950'
                                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span className="text-xs font-medium">{opt.name}</span>
                              <div className="flex items-center gap-2">
                                {opt.priceDelta ? (
                                  <span className="text-xs font-bold text-emerald-700">
                                    +${opt.priceDelta.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">Gratis</span>
                                )}
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                    isSelected
                                      ? 'border-emerald-600 bg-emerald-600 text-white'
                                      : 'border-slate-300'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3" />}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add to Cart CTA */}
              <div className="pt-3 sticky bottom-0 bg-white">
                <button
                  onClick={handleAddCustomizedToCart}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Añadir al Carrito (${currentModalPrice.toFixed(2)})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart & Checkout Sliding Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        currency={activeTenantConfig.currency || 'USD'}
        exchangeRateVES={activeTenantConfig.exchangeRateVES}
        showVES={activeTenantConfig.showVES}
        tenantSlug={tenant.slug}
        storeName={activeTenantConfig.name}
        whatsappPhone={tenant.whatsappPhone}
        onUpdateQuantity={handleUpdateQuantity}
        onClearCart={() => setCart([])}
      />
    </div>
  );
}

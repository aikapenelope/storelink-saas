/**
 * This file was auto-generated via payload generate:types (manual fallback for Node 22 ESM compatibility).
 * DO NOT EDIT MANUALLY — run `pnpm generate:types` to regenerate after collection changes.
 */

export interface Config {
  auth: {
    users: {
      disableLocalStrategy: false;
    };
  };
  collections: {
    tenants: Tenant;
    users: User;
    categories: Category;
    products: Product;
    orders: Order;
    customers: Customer;
    media: Media;
  };
  db: {
    defaultIDType: number;
  };
  globals: Record<string, never>;
  locale: null;
  user: User & {
    collection: 'users';
  };
}

export type DeliveryZone = {
  id?: string | null;
  name: string;
  priceDelivery?: number | null;
  estimatedTime?: string | null;
};

export type Tenant = {
  id: number;
  name: string;
  slug: string;
  theme?:
    | 'basic-banner'
    | 'food-delivery'
    | 'fashion-boutique'
    | 'moto-parts'
    | 'hardware-store'
    | 'b2b-matrix'
    | 'editorial'
    | 'fluid-pwa'
    | 'vercel-commerce'
    | null;
  whatsappPhone: string;
  emailConfig?: {
    enabled?: boolean | null;
    resendApiKey?: string | null;
    fromEmail?: string | null;
    notificationEmail?: string | null;
    emailSubject?: string | null;
  };
  trelloConfig?: {
    enabled?: boolean | null;
    workspaceName?: string | null;
    boardName?: string | null;
    boardUrl?: string | null;
    listId?: string | null;
  };
  branding?: {
    logo?: number | Media | null;
    currency?: 'USD' | 'EUR' | 'MXN' | 'COP' | null;
    showVES?: boolean | null;
    exchangeRateVES?: number | null;
    primaryColor?: string | null;
    welcomeMessage?: string | null;
  };
  pickupConfig?: {
    enabled?: boolean | null;
    locationAddress?: string | null;
    schedule?: string | null;
    estimatedTime?: string | null;
    instructions?: string | null;
  };
  paymentMethodsConfig?: {
    pagoMovil?: {
      enabled?: boolean | null;
      bank?: string | null;
      phone?: string | null;
      idDoc?: string | null;
      accountHolder?: string | null;
    };
    zelle?: {
      enabled?: boolean | null;
      email?: string | null;
      accountHolder?: string | null;
    };
    binance?: {
      enabled?: boolean | null;
      payId?: string | null;
      nickname?: string | null;
    };
    zinli?: {
      enabled?: boolean | null;
      email?: string | null;
      accountHolder?: string | null;
    };
    banescoPanama?: {
      enabled?: boolean | null;
      accountNumber?: string | null;
      accountHolder?: string | null;
      accountType?: string | null;
    };
    cash?: {
      enabled?: boolean | null;
      instructions?: string | null;
    };
    pos?: {
      enabled?: boolean | null;
      instructions?: string | null;
    };
  };
  deliveryConfig?: {
    fixedPrice?: number | null;
    estimatedTime?: string | null;
    zones?: DeliveryZone[] | null;
  };
  meta?: {
    title?: string | null;
    description?: string | null;
    image?: number | Media | null;
  };
  updatedAt: string;
  createdAt: string;
};

export type User = {
  id: number;
  role: 'super-admin' | 'tenant-admin';
  updatedAt: string;
  createdAt: string;
  email: string;
  resetPasswordToken?: string | null;
  resetPasswordExpiration?: string | null;
  salt?: string | null;
  hash?: string | null;
  loginAttempts?: number | null;
  lockUntil?: string | null;
};

export type Category = {
  id: number;
  name: string;
  slug?: string | null;
  order?: number | null;
  tenant?: number | Tenant | null;
  updatedAt: string;
  createdAt: string;
};

export type ProductVariant = {
  id?: string | null;
  name: string;
  sku?: string | null;
  price: number;
  stockQuantity?: number | null;
  stockStatus: 'in_stock' | 'out_of_stock';
};

export type ProductModifierOption = {
  id?: string | null;
  name: string;
  priceDelta?: number | null;
};

export type ProductModifier = {
  id?: string | null;
  groupName: string;
  required?: boolean | null;
  options?: ProductModifierOption[] | null;
};

export type ProductImage = {
  id?: string | null;
  image?: number | Media | null;
};

export type Product = {
  id: number;
  tenant?: number | Tenant | null;
  title: string;
  sku?: string | null;
  price: number;
  description?: string | null;
  category?: number | Category | null;
  stockStatus?: 'in_stock' | 'out_of_stock' | 'pre_order' | null;
  trackStock?: boolean | null;
  stockQuantity?: number | null;
  featured?: boolean | null;
  variants?: ProductVariant[] | null;
  modifiers?: ProductModifier[] | null;
  imageUrl?: string | null;
  images?: ProductImage[] | null;
  meta?: {
    title?: string | null;
    description?: string | null;
    image?: number | Media | null;
  };
  updatedAt: string;
  createdAt: string;
};

export type OrderItem = {
  id?: string | null;
  sku?: string | null;
  title: string;
  price: number;
  quantity: number;
  subtotal?: number | null;
};

export type OrderDeliveryDetails = {
  municipality?: string | null;
  residenceZone?: string | null;
  buildingHouse?: string | null;
  referencePoint?: string | null;
};

export type OrderPaymentDetails = {
  methodKey?: 'pago_movil' | 'zelle' | 'binance' | 'zinli' | 'banesco_panama' | 'cash' | 'pos' | null;
  referenceNumber?: string | null;
  issuingBank?: string | null;
  issuingPhone?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  binanceSenderId?: string | null;
  paymentStatus?: 'pending_verification' | 'verified' | 'rejected' | null;
};

export type Order = {
  id: number;
  tenant?: number | Tenant | null;
  orderNumber: string;
  /** Snapshot de la tasa VES aplicada al pedido (audit fix: conciliación) */
  exchangeRateVES?: number | null;
  status: 'pending' | 'confirmed' | 'preparing' | 'in_delivery' | 'delivered' | 'cancelled';
  deliveryType?: 'delivery' | 'pickup' | null;
  deliveryDetails?: OrderDeliveryDetails | null;
  paymentDetails?: OrderPaymentDetails | null;
  customer?: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    paymentMethod?: string | null;
    notes?: string | null;
  };
  items?: OrderItem[] | null;
  totalAmount: number;
  currency?: string | null;
  trelloCardUrl?: string | null;
  emailConfirmationSent?: boolean | null;
  updatedAt: string;
  createdAt: string;
};

export type CustomerSavedAddress = {
  id?: string | null;
  label?: string | null;
  municipality?: string | null;
  residenceZone?: string | null;
  buildingHouse?: string | null;
  referencePoint?: string | null;
  address?: string | null;
};

export type Customer = {
  id: number;
  tenant?: number | Tenant | null;
  name: string;
  phone: string;
  email?: string | null;
  tag?: 'nuevo' | 'frecuente' | 'vip' | 'inactivo' | null;
  totalOrders?: number | null;
  totalSpent?: number | null;
  lastOrderAt?: string | null;
  savedAddresses?: CustomerSavedAddress[] | null;
  notes?: string | null;
  updatedAt: string;
  createdAt: string;
};

export type Media = {
  id: number;
  tenant?: number | Tenant | null;
  alt?: string | null;
  updatedAt: string;
  createdAt: string;
  url?: string | null;
  thumbnailURL?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  filesize?: number | null;
  width?: number | null;
  height?: number | null;
  focalX?: number | null;
  focalY?: number | null;
};

declare module 'payload' {
  export interface GeneratedTypes extends Config {}
}

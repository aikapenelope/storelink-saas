'use client';

import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Send,
  FileDown,
  CheckCircle2,
  X,
  Truck,
  Store,
  MapPin,
  Clock,
  Info,
  CreditCard,
  Smartphone,
  DollarSign,
  Camera,
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import type { ProductItem } from '@/components/storefront-client';
import { processOrder } from '@/app/actions/checkout';
import { isCheckoutProcessingResponse } from '@/lib/checkout-response';
import {
  clearCheckoutIntentToken,
  getOrCreateCheckoutIntentToken,
} from '@/lib/checkout-intent-token';
// PR 12 (thermo D3): sección de métodos de pago data-driven.
import {
  AccountCard,
  PaymentMethodGrid,
  VerificationForm,
  WhatsAppProofCallout,
  type AccountCardConfig,
  type MethodButtonConfig,
  type PaymentMethodKey,
  type PaymentVerificationState,
  type VerificationFormConfig,
} from './cart-drawer/payment-methods';

export interface CartItem extends ProductItem {
  quantity: number;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  currency?: string;
  exchangeRateVES?: number;
  showVES?: boolean;
  storeName: string;
  whatsappPhone: string;
  /** Modo preview visual (página demo /demo): el carrito se ve pero NO envía pedidos */
  preview?: boolean;
  tenantSlug: string;
  /** Nonce anti-abuso emitido por [tenant]/page.tsx (Sprint 5) */
  checkoutNonce?: string;
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
    zones?: Array<{
      id?: string | null;
      name: string;
      priceDelivery?: number | null;
      estimatedTime?: string | null;
    }> | null;
  };
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onClearCart: () => void;
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  currency = 'USD',
  exchangeRateVES = 0,
  showVES = false,
  storeName,
  preview = false,
  tenantSlug,
  checkoutNonce,
  pickupConfig,
  paymentMethodsConfig,
  deliveryConfig,
  onUpdateQuantity,
  onClearCart,
}: CartDrawerProps) {
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [phoneOperator, setPhoneOperator] = useState('414');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Anti-abuso Sprint 5: honeypot (debe llegar vacío) y timestamp del primer
  // render del formulario. Se fija en useEffect al abrir el drawer para no
  // depender del render SSR (evita mismatch de hidratación) y para que el
  // servidor pueda rechazar envíos <3s como bots.
  const [honeypotWebsite, setHoneypotWebsite] = useState('');
  const [formRenderedAtMs, setFormRenderedAtMs] = useState(0);
  useEffect(() => {
    if (isOpen && formRenderedAtMs === 0) {
      setFormRenderedAtMs(Date.now());
    }
  }, [isOpen, formRenderedAtMs]);

  // Dynamic merchant account values from Payload DB
  // Audit fix: sin datos bancarios FALSOS hardcodeados. Si el comercio no ha
  // configurado un método en su panel, el cliente ve un aviso claro y no una
  // cuenta inventada donde depositar su dinero.
  const pmBank = paymentMethodsConfig?.pagoMovil?.bank || '';
  const pmPhone = paymentMethodsConfig?.pagoMovil?.phone || '';
  const pmIdDoc = paymentMethodsConfig?.pagoMovil?.idDoc || '';
  const pmHolder = paymentMethodsConfig?.pagoMovil?.accountHolder || storeName;
  const pagoMovilConfigurado = Boolean(pmBank && pmPhone && pmIdDoc);

  const zelleEmail = paymentMethodsConfig?.zelle?.email || '';
  const zelleHolder = paymentMethodsConfig?.zelle?.accountHolder || storeName;
  const zelleConfigurado = Boolean(zelleEmail);

  const binancePayId = paymentMethodsConfig?.binance?.payId || '';
  const binanceNick = paymentMethodsConfig?.binance?.nickname || '';
  const binanceConfigurado = Boolean(binancePayId || binanceNick);

  const zinliEmail = paymentMethodsConfig?.zinli?.email || '';
  const zinliHolder = paymentMethodsConfig?.zinli?.accountHolder || storeName;
  const zinliConfigurado = Boolean(zinliEmail);

  const banescoAcc = paymentMethodsConfig?.banescoPanama?.accountNumber || '';
  const banescoHolder = paymentMethodsConfig?.banescoPanama?.accountHolder || storeName;
  const banescoConfigurado = Boolean(banescoAcc);

  const pickupLoc = pickupConfig?.locationAddress || `${storeName} - Sede Principal`;
  const pickupSched = pickupConfig?.schedule || 'Lun-Dom 11:30 AM - 10:00 PM';
  const pickupTime = pickupConfig?.estimatedTime || '20-30 min';

  // Default Payment Method Detection based on configured merchant accounts
  const defaultMethod = pagoMovilConfigurado
    ? 'pago_movil'
    : zelleConfigurado
    ? 'zelle'
    : binanceConfigurado
    ? 'binance'
    : zinliConfigurado
    ? 'zinli'
    : banescoConfigurado
    ? 'banesco_panama'
    : 'cash';

  // Payment Method Selection
  const [paymentMethodKey, setPaymentMethodKey] = useState<PaymentMethodKey>(defaultMethod);

  const itemsSubtotal = items.reduce((acc, item) => acc + item.quantity * item.price, 0);
  const selectedZone = deliveryConfig?.zones?.find((z) => z.name === customer.municipality);
  const zoneDeliveryPrice =
    selectedZone && typeof selectedZone.priceDelivery === 'number' ? selectedZone.priceDelivery : null;
  const deliveryFee =
    deliveryType === 'delivery' ? (zoneDeliveryPrice ?? Number(deliveryConfig?.fixedPrice || 0)) : 0;
  const total = itemsSubtotal + deliveryFee;
  const totalVES = total * exchangeRateVES;

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // PR 12 (thermo D3): configs data-driven de la sección de pago — classNames
  // LITERALES EXACTOS del original (HTML byte-idéntico). Los condicionales
  // de disponibilidad (`? : null` del grid original) se preservan filtrando
  // el array por configuración del comercio.
  const methodButtons: MethodButtonConfig[] = [
    ...(pagoMovilConfigurado
      ? [{
          method: 'pago_movil' as const,
          label: 'Pago Móvil VES',
          icon: <Smartphone className="w-4 h-4 text-emerald-600 flex-shrink-0" />,
          iconClass: 'text-emerald-600',
          selectedClass: 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-600 shadow-xs',
        }]
      : []),
    ...(zelleConfigurado
      ? [{
          method: 'zelle' as const,
          label: 'Zelle USD',
          icon: <CreditCard className="w-4 h-4 text-purple-600 flex-shrink-0" />,
          iconClass: 'text-purple-600',
          selectedClass: 'border-purple-600 bg-purple-50 text-purple-950 font-bold ring-1 ring-purple-600 shadow-xs',
        }]
      : []),
    ...(binanceConfigurado
      ? [{
          method: 'binance' as const,
          label: 'Binance Pay USDT',
          icon: <CreditCard className="w-4 h-4 text-amber-600 flex-shrink-0" />,
          iconClass: 'text-amber-600',
          selectedClass: 'border-amber-600 bg-amber-50 text-amber-950 font-bold ring-1 ring-amber-600 shadow-xs',
        }]
      : []),
    ...(zinliConfigurado
      ? [{
          method: 'zinli' as const,
          label: 'Zinli USD',
          icon: <CreditCard className="w-4 h-4 text-indigo-600 flex-shrink-0" />,
          iconClass: 'text-indigo-600',
          selectedClass: 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold ring-1 ring-indigo-600 shadow-xs',
        }]
      : []),
    ...(banescoConfigurado
      ? [{
          method: 'banesco_panama' as const,
          label: 'Banesco Panamá',
          icon: <CreditCard className="w-4 h-4 text-blue-600 flex-shrink-0" />,
          iconClass: 'text-blue-600',
          selectedClass: 'border-blue-600 bg-blue-50 text-blue-950 font-bold ring-1 ring-blue-600 shadow-xs',
        }]
      : []),
    {
      method: 'cash' as const,
      label: 'Efectivo ($ / Bs)',
      icon: <DollarSign className="w-4 h-4 text-emerald-600 flex-shrink-0" />,
      iconClass: 'text-emerald-600',
      selectedClass: 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-600 shadow-xs',
    },
    {
      method: 'pos' as const,
      label: 'Punto en Tienda',
      icon: <CreditCard className="w-4 h-4 text-slate-600 flex-shrink-0" />,
      iconClass: 'text-slate-600',
      selectedClass: 'border-slate-800 bg-slate-100 text-slate-950 font-bold ring-1 ring-slate-800 shadow-xs',
      // El POS ocupa el ancho completo en móvil (original col-span-2).
      extraClass: 'col-span-2 sm:col-span-1',
    },
  ];

  // Cards de cuenta del método seleccionado (una por método con datos).
  const accountCards: AccountCardConfig[] = [
    {
      method: 'pago_movil',
      cardClass: 'bg-slate-900 text-white rounded-2xl p-3.5 space-y-2 shadow-md',
      headerBorderClass: 'border-b border-slate-800',
      headerLabelClass: 'text-emerald-400',
      headerLabel: 'Datos para Pago Móvil',
      rows: [
        {
          label: 'Banco Receptores',
          value: pmBank,
          copyKey: 'pm_banco',
        },
        {
          label: 'Teléfono',
          value: pmPhone,
          copyKey: 'pm_phone',
          copyTransform: (v) => v.replace(/\D/g, ''),
        },
        {
          label: 'C.I. / RIF',
          value: pmIdDoc,
          copyKey: 'pm_rif',
          copyTransform: (v) => v.replace(/[-.\s]/g, ''),
        },
        {
          label: 'Titular',
          value: pmHolder,
          copyKey: 'pm_titular',
        },
        ...(showVES
          ? [{
              label: 'Monto Exacto a Transferir',
              value: totalVES.toFixed(2),
              amountValue: `Bs. ${totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              copyKey: 'pm_monto',
              copyLabel: 'Copiar Monto',
              buttonClass: 'px-2.5 py-1 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 border border-emerald-700/50',
              checkClass: 'text-emerald-300',
              labelClass: 'text-slate-400',
              amountLabelClass: 'text-emerald-400',
              amountValueClass: 'text-emerald-400',
              amountRow: true,
            }]
          : []),
      ],
    },
    {
      method: 'zelle',
      cardClass: 'bg-purple-950 text-white rounded-2xl p-3.5 space-y-2 shadow-md',
      headerBorderClass: 'border-b border-purple-900',
      headerLabelClass: 'text-purple-300',
      headerLabel: 'Datos para Pago Zelle',
      rows: [
        {
          label: 'Correo Zelle',
          value: zelleEmail,
          copyKey: 'zelle_email',
          buttonClass: 'px-2.5 py-1 bg-purple-900 hover:bg-purple-800 text-purple-200',
          checkClass: 'text-purple-300',
          labelClass: 'text-purple-300',
        },
        {
          label: 'Titular',
          value: zelleHolder,
          copyKey: 'zelle_titular',
          buttonClass: 'px-2.5 py-1 bg-purple-900 hover:bg-purple-800 text-purple-200',
          checkClass: 'text-purple-300',
          labelClass: 'text-purple-300',
        },
        {
          label: 'Monto Exacto USD',
          value: total.toFixed(2),
          amountValue: `$${total.toFixed(2)} USD`,
          copyKey: 'zelle_monto',
          copyLabel: 'Copiar Monto',
          buttonClass: 'px-2.5 py-1 bg-purple-900 hover:bg-purple-800 text-purple-200 border border-purple-700/50',
          checkClass: 'text-purple-300',
          amountLabelClass: 'text-purple-300',
          amountValueClass: 'text-purple-200',
          amountRow: true,
        },
      ],
    },
    {
      method: 'binance',
      cardClass: 'bg-slate-900 text-white rounded-2xl p-3.5 space-y-2 shadow-md',
      headerBorderClass: 'border-b border-slate-800',
      headerLabelClass: 'text-amber-400',
      headerLabel: 'Datos Binance Pay (USDT)',
      rows: [
        {
          label: 'Binance Pay ID',
          value: binancePayId,
          copyKey: 'binance_payid',
          copyLabel: 'Copiar ID',
          buttonClass: 'px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400',
          checkClass: 'text-amber-400',
        },
        {
          label: 'Nickname',
          value: binanceNick,
          copyKey: 'binance_nick',
          buttonClass: 'px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200',
          checkClass: 'text-amber-400',
        },
        {
          label: 'Monto Total USDT',
          value: total.toFixed(2),
          amountValue: `${total.toFixed(2)} USDT`,
          copyKey: 'binance_monto',
          copyLabel: 'Copiar Monto',
          buttonClass: 'px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/50',
          checkClass: 'text-amber-400',
          amountLabelClass: 'text-amber-400',
          amountValueClass: 'text-amber-400',
          amountRow: true,
        },
      ],
    },
    {
      method: 'zinli',
      cardClass: 'bg-slate-900 text-white rounded-2xl p-3.5 space-y-2 shadow-md',
      headerBorderClass: 'border-b border-slate-800',
      headerLabelClass: 'text-indigo-400',
      headerLabel: 'Datos para Pago Zinli',
      rows: [
        {
          label: 'Correo Zinli',
          value: zinliEmail,
          copyKey: 'zinli_email',
          buttonClass: 'px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300',
          checkClass: 'text-indigo-400',
        },
        {
          label: 'Titular',
          value: zinliHolder,
          copyKey: 'zinli_titular',
          buttonClass: 'px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200',
          checkClass: 'text-indigo-400',
        },
        {
          label: 'Monto Total USD',
          value: total.toFixed(2),
          amountValue: `$${total.toFixed(2)} USD`,
          copyKey: 'zinli_monto',
          copyLabel: 'Copiar Monto',
          buttonClass: 'px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/50',
          checkClass: 'text-indigo-400',
          amountLabelClass: 'text-indigo-400',
          amountValueClass: 'text-indigo-400',
          amountRow: true,
        },
      ],
    },
    {
      method: 'banesco_panama',
      cardClass: 'bg-slate-900 text-white rounded-2xl p-3.5 space-y-2 shadow-md',
      headerBorderClass: 'border-b border-slate-800',
      headerLabelClass: 'text-blue-400',
      headerLabel: 'Banesco Panamá (Transferencia USD)',
      rows: [
        {
          label: 'Banco',
          value: 'Banesco Panamá',
          copyKey: 'bp_banco',
          buttonClass: 'px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200',
          checkClass: 'text-blue-400',
        },
        {
          label: 'N° Cuenta Corriente',
          value: banescoAcc,
          copyKey: 'bp_cuenta',
          copyLabel: 'Copiar N°',
          copyTransform: (v) => v.replace(/[-.\s]/g, ''),
          buttonClass: 'px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400',
          checkClass: 'text-blue-400',
        },
        {
          label: 'Titular',
          value: banescoHolder,
          copyKey: 'bp_titular',
          buttonClass: 'px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200',
          checkClass: 'text-blue-400',
        },
        {
          label: 'Monto Total USD',
          value: total.toFixed(2),
          amountValue: `$${total.toFixed(2)} USD`,
          copyKey: 'bp_monto',
          copyLabel: 'Copiar Monto',
          buttonClass: 'px-2.5 py-1 bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-700/50',
          checkClass: 'text-blue-400',
          amountLabelClass: 'text-blue-400',
          amountValueClass: 'text-blue-400',
          amountRow: true,
        },
      ],
    },
  ];

  const selectedAccountCard =
    paymentMethodKey === 'cash' || paymentMethodKey === 'pos'
      ? undefined
      : accountCards.find((c) => c.method === paymentMethodKey);

  // Formularios de verificación (por método digital; cash/pos no verifican).
  const verificationForms: VerificationFormConfig[] = [
    {
      method: 'pago_movil',
      title: 'Datos de tu Pago Móvil para Verificación:',
      fields: [
        {
          label: 'Banco Emisor (desde donde pagaste) *',
          type: 'text',
          placeholder: '',
          stateKey: 'issuingBank',
          selectOptions: [
            'Banesco',
            'Banco de Venezuela (BDV)',
            'Banco Mercantil',
            'BBVA Provincial',
            'Bancaribe',
            'BNC (Banco Nacional de Crédito)',
            'Bancamiga',
            'Banplus',
            'Banco Plaza',
            '100% Banco',
            'Otro Banco',
          ],
        },
      ],
      // El original renderiza teléfono + referencia en grid grid-cols-2.
      gridFields: [
        {
          label: 'Teléfono Emisor',
          type: 'tel',
          placeholder: '0414 1234567',
          stateKey: 'issuingPhone',
        },
        {
          label: 'N° Referencia (4 a 6 dígitos) *',
          type: 'text',
          required: true,
          placeholder: 'Ej: 489201',
          stateKey: 'referenceNumber',
          inputClass: 'font-mono font-bold',
        },
      ],
    },
    {
      method: 'zelle',
      title: 'Datos de tu Transferencia Zelle:',
      fields: [
        {
          label: 'Nombre del Titular de la Cuenta Zelle Emisora *',
          type: 'text',
          required: true,
          placeholder: 'Nombre que figura en tu Zelle',
          stateKey: 'senderName',
        },
        {
          label: 'Número de Confirmación / Referencia Zelle *',
          type: 'text',
          required: true,
          placeholder: 'Ej: ZEL-948102',
          stateKey: 'referenceNumber',
          inputClass: 'font-mono font-bold',
        },
      ],
    },
    {
      method: 'binance',
      title: 'Datos de tu Pago Binance:',
      fields: [
        {
          label: 'Tu Pay ID o Nickname de Binance *',
          type: 'text',
          required: true,
          placeholder: 'Ej: TuNickname / 19283746',
          stateKey: 'binancePayId',
        },
        {
          label: 'Order ID / TXID de Transacción *',
          type: 'text',
          required: true,
          placeholder: 'Ej: 204918273619',
          stateKey: 'referenceNumber',
          inputClass: 'font-mono font-bold',
        },
      ],
    },
    {
      method: 'zinli',
      title: 'Datos de tu Pago Zinli:',
      fields: [
        {
          label: 'Correo o Teléfono de tu Cuenta Zinli *',
          type: 'text',
          required: true,
          placeholder: 'tucuenta@email.com o +58...',
          stateKey: 'senderEmail',
        },
        {
          label: 'Número de Referencia Zinli *',
          type: 'text',
          required: true,
          placeholder: 'Ej: 198274',
          stateKey: 'referenceNumber',
          inputClass: 'font-mono font-bold',
        },
      ],
    },
    {
      method: 'banesco_panama',
      title: 'Datos de Transferencia Banesco Panamá:',
      fields: [
        {
          label: 'Nombre del Titular de la Cuenta Emisora *',
          type: 'text',
          required: true,
          placeholder: 'Nombre del emisor',
          stateKey: 'senderName',
        },
        {
          label: 'Número de Referencia de la Transferencia *',
          type: 'text',
          required: true,
          placeholder: 'Ej: BP-291840',
          stateKey: 'referenceNumber',
          inputClass: 'font-mono font-bold',
        },
      ],
    },
  ];

  const selectedVerificationForm = verificationForms.find((f) => f.method === paymentMethodKey);

  const handleVerificationChange = (key: keyof PaymentVerificationState, value: string) => {
    setPaymentVerification((prev) => ({ ...prev, [key]: value }));
  };

  // Customer Verification Fields
  const [paymentVerification, setPaymentVerification] = useState({
    issuingBank: 'Banesco',
    issuingPhone: '',
    referenceNumber: '',
    senderName: '',
    senderEmail: '',
    binancePayId: '',
  });

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Review Devin #73 (2ª ronda): cuando el tenant define zonas, el estado
  // inicial del municipio debe ser una zona VÁLIDA (la primera) — el default
  // fijo "Municipio Chacao" no coincide con ninguna opción del selector y el
  // envío sin tocar el select sería rechazado por el servidor con un total
  // mostrado distinto. Sin zonas se mantiene el default de Caracas.
  const initialMunicipality =
    deliveryConfig?.zones && deliveryConfig.zones.length > 0
      ? (deliveryConfig.zones.find((z) => z.name)?.name ?? 'Municipio Chacao')
      : 'Municipio Chacao';

  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    address: '',
    buildingHouse: '',
    municipality: initialMunicipality,
    notes: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  // Auditoría 2026-09-04 (P1 privacidad): el checkout recolecta nombre,
  // teléfono, email y dirección sin aviso ni consentimiento. Checkbox
  // obligatorio + enlace al Aviso de Privacidad (/privacidad).
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{
    orderNumber: string;
    whatsappUrl: string;
    pdfBase64?: string;
    totalUSD?: number;
    totalVES?: number;
  } | null>(null);

  // Review Devin #74 (2ª ronda): el token de intención ya NO vive en un ref
  // (perdía el vínculo con la reserva al recargar o abrir otra pestaña con el
  // mismo carrito → token nuevo → clave nueva → segunda orden). Vive en
  // localStorage junto al ciclo de vida del carrito del tenant:
  //  - getOrCreate al submit: recarga/2ª pestaña → MISMO token → MISMA clave
  //    → el reintento se adhiere a la reserva existente.
  //  - clear tras resultado TERMINAL (éxito/fallo definitivo) o carrito
  //    vaciado (compra nueva intencional — mismo momento en que
  //    StorefrontClient borra su storage).
  //  - PRESERVADO en "en proceso" y fallo de transporte.
  const checkoutIntentStorage = (): Storage | null =>
    typeof window === 'undefined' ? null : window.localStorage;


  // Review Devin #74 (2ª ronda): el carrito vaciado (éxito con onClearCart o
  // el usuario eliminando todo) es una COMPRA NUEVA INTENCIONAL → rota el
  // token para que el próximo intento tenga su propia reserva de idempotencia.
  useEffect(() => {
    if (items.length === 0) {
      clearCheckoutIntentToken(checkoutIntentStorage(), tenantSlug);
    }
  }, [items, tenantSlug]);
  // Auditoría 2026-09-04 (P2): tarifa por ZONA. Antes se mostraba "(+$X)" en
  // el selector de municipios pero el total siempre cobraba la tarifa fija.
  // Espejo exacto de la resolución server-side en checkout.ts (la fuente de
  // verdad sigue siendo el servidor; esto evita que el cliente vea un total
  // distinto al que se le cobra).
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    // Modo preview visual (página demo): no se envían pedidos
    if (preview) {
      return;
    }

    if (!customer.name.trim()) {
      alert('Por favor ingresa tu nombre completo.');
      return;
    }

    if (!customer.email.trim() || !customer.email.includes('@')) {
      alert('Por favor ingresa un correo electrónico válido para recibir tu comprobante y nota de entrega.');
      return;
    }

    const cleanPhoneDigits = phoneNumber.replace(/\D/g, '');
    if (cleanPhoneDigits.length < 7) {
      alert('Por favor ingresa un número de teléfono de 7 dígitos válido (ej. 123 4567).');
      return;
    }

    const fullFormattedPhone = `+58 ${phoneOperator} ${cleanPhoneDigits}`;

    if (deliveryType === 'delivery') {
      if (
        !customer.address.trim() ||
        !customer.buildingHouse.trim() ||
        !customer.municipality.trim()
      ) {
        alert('Por favor completa los tres campos obligatorios de la dirección de delivery.');
        return;
      }
    }

    if (!acceptedPrivacy) {
      alert('Por favor acepta el Aviso de Privacidad para continuar con tu pedido.');
      return;
    }

    // Format payment details label for backend & WhatsApp
    let paymentLabel = '';
    if (paymentMethodKey === 'pago_movil') {
      paymentLabel = `Pago Móvil VES (Banco Emisor: ${paymentVerification.issuingBank || 'No especificado'}, Ref: #${paymentVerification.referenceNumber || 'N/A'})`;
    } else if (paymentMethodKey === 'zelle') {
      paymentLabel = `Zelle USD (Titular Emisor: ${paymentVerification.senderName || 'No especificado'}, Ref: #${paymentVerification.referenceNumber || 'N/A'})`;
    } else if (paymentMethodKey === 'binance') {
      paymentLabel = `Binance Pay USDT (ID/Nick: ${paymentVerification.binancePayId || 'No especificado'}, TXID: #${paymentVerification.referenceNumber || 'N/A'})`;
    } else if (paymentMethodKey === 'zinli') {
      paymentLabel = `Zinli USD (Cuenta Emisora: ${paymentVerification.senderEmail || 'No especificada'}, Ref: #${paymentVerification.referenceNumber || 'N/A'})`;
    } else if (paymentMethodKey === 'banesco_panama') {
      paymentLabel = `Banesco Panamá USD (Titular: ${paymentVerification.senderName || 'No especificado'}, Ref: #${paymentVerification.referenceNumber || 'N/A'})`;
    } else if (paymentMethodKey === 'cash') {
      paymentLabel = `Dólares en Efectivo (Contra Entrega / Pago en Local)`;
    } else if (paymentMethodKey === 'pos') {
      paymentLabel = `Punto de Venta / Débito (En tienda/retiro)`;
    }

    setIsLoading(true);

    // Review Devin #74 (2ª ronda): token persistido en localStorage — un
    // reload o una segunda pestaña con el mismo carrito obtienen el MISMO
    // token y recaen en la MISMA reserva de idempotencia.
    const intentToken = getOrCreateCheckoutIntentToken(checkoutIntentStorage(), tenantSlug);

    // Audit fix: la dirección de pickup viene de la config del tenant
    // (prop pickupConfig), nunca hardcodeada de una sola tienda.
    const pickupText = `[RETIRO EN TIENDA / PICKUP] ${pickupLoc}${pickupSched ? ` (Horario: ${pickupSched})` : ''}`;

    const formattedAddress =
      deliveryType === 'delivery'
        ? `[DELIVERY] Dirección/Zona: ${customer.address}, Edif/Casa: ${customer.buildingHouse}, ${customer.municipality}`
        : pickupText;

    try {
      const response = await processOrder({
        tenantSlug,
        storeName,
        currency,
        exchangeRateVES,
        showVES,
        checkoutNonce: checkoutNonce ?? '',
        honeypotWebsite,
        formRenderedAtMs: formRenderedAtMs || undefined,
        // Review Devin #74 (2ª ronda): token persistido con el carrito del
        // tenant (ver comentario arriba) — recarga/2ª pestaña → mismo token.
        idempotencyToken: intentToken,
        customer: {
          name: customer.name,
          phone: fullFormattedPhone,
          email: customer.email,
          address: formattedAddress,
          paymentMethod: paymentLabel,
          notes: customer.notes,
          deliveryType,
          deliveryDetails:
            deliveryType === 'delivery'
              ? {
                  municipality: customer.municipality,
                  residenceZone: customer.address,
                  buildingHouse: customer.buildingHouse,
                  referencePoint: '',
                }
              : undefined,
          paymentDetails: {
            methodKey: paymentMethodKey,
            referenceNumber: paymentVerification.referenceNumber,
            issuingBank: paymentVerification.issuingBank,
            issuingPhone: paymentVerification.issuingPhone,
            senderName: paymentVerification.senderName,
            senderEmail: paymentVerification.senderEmail,
            binanceSenderId: paymentVerification.binancePayId,
            paymentStatus: 'pending_verification',
          },
        },
        items: items.map((i) => ({
          sku: i.sku,
          title: i.title,
          quantity: i.quantity,
          price: i.price,
          modifiers: i.selectedModifiers,
        })),
      });

      if (response.success && response.whatsappUrl && response.orderNumber) {
        setCompletedOrder({
          orderNumber: response.orderNumber,
          whatsappUrl: response.whatsappUrl,
          pdfBase64: response.pdfBase64,
          // Totales confirmados por el servidor (fuente oficial del pedido).
          totalUSD: response.totalUSD,
          totalVES: response.totalVES,
        });

        // Open WhatsApp directly in new window / app
        window.open(response.whatsappUrl, '_blank');
        onClearCart();
      } else if (isCheckoutProcessingResponse(response)) {
        // Review Devin #74 ("Slow retries create duplicate orders"): otro
        // request idéntico SIGUE en proceso — NO limpiar el token: el
        // reintento del usuario debe recaer en la MISMA reserva de
        // idempotencia y recibir la respuesta del dueño, no crear otra orden.
        alert(response.error);
        return;
      } else {
        // Fallo DEFINITIVO antes de crear la orden (validación, stock, zona,
        // guards…): la reserva ya fue liberada por el servidor y el siguiente
        // envío es un intento nuevo → ROTAR el token (resultado terminal).
        clearCheckoutIntentToken(checkoutIntentStorage(), tenantSlug);
        alert(response.error || 'Hubo un error al procesar el pedido.');
      }
      // Éxito definitivo (resultado terminal): el onClearCart de arriba vacía
      // el carrito y el efecto de items.length === 0 rota el token; se limpia
      // aquí también por si el clear del carrito llegara a fallar.
      clearCheckoutIntentToken(checkoutIntentStorage(), tenantSlug);
    } catch (err: unknown) {
      // Fallo de transporte: el body pudo haberse procesado en el servidor sin
      // respuesta — conservar el token para que el reintento del usuario reciba
      // la respuesta del dueño en vez de duplicar la orden.
      console.error(err);
      alert('Error de conexión al procesar el pedido.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!completedOrder?.pdfBase64) return;
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${completedOrder.pdfBase64}`;
    link.download = `Nota-Entrega-${completedOrder.orderNumber}.pdf`;
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm flex justify-end">
      <div className="bg-white w-full max-w-md h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200 font-sans">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
            <h2 className="font-black text-slate-900 text-lg">Tu Pedido</h2>
            <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
              {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
            </span>
          </div>
          <button
            onClick={() => {
              setCompletedOrder(null);
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {completedOrder ? (
            <div className="py-6 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-1">¡Pedido Registrado con Éxito!</h3>
              <p className="text-xs text-slate-500 font-mono mb-4">N° de Orden: #{completedOrder.orderNumber}</p>

              {/* Totales confirmados por el SERVIDOR (auditoría 2026-09-04): la
                  tasa mostrada durante el armado del carrito venía del HTML
                  ISR (hasta 5 min de antigüedad); el pedido usa la resuelta en
                  vivo. Este monto es el oficial que cobra el comercio. */}
              {typeof completedOrder.totalUSD === 'number' && (
                <p className="text-sm font-black text-slate-900 mb-4">
                  Monto confirmado: {formatPrice(completedOrder.totalUSD, currency)}
                  {typeof completedOrder.totalVES === 'number' && completedOrder.totalVES > 0 && (
                    <span className="block text-xs text-slate-600 font-mono font-bold mt-0.5">
                      Bs. {completedOrder.totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </p>
              )}

              {/* Friendly Reminder Box */}
              <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 text-left text-xs text-amber-950 space-y-2 mb-6 w-full shadow-xs">
                <div className="flex items-center gap-2 font-black text-amber-900">
                  <Camera className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>💡 Para agilizar el despacho de tu pedido:</span>
                </div>
                <ul className="space-y-1.5 text-amber-800 text-[11px] leading-snug pl-5 list-disc font-medium">
                  <li>Adjunta por el chat de WhatsApp la <strong>captura de la transferencia / pago móvil</strong> (o foto de los billetes si pagas en efectivo).</li>
                  <li>Comparte tu <strong>ubicación en tiempo real</strong> en WhatsApp para que el repartidor te ubique al instante.</li>
                  <li>Confirma tu <strong>nombre y punto de referencia</strong>.</li>
                </ul>
              </div>

              <div className="w-full space-y-3">
                <a
                  href={completedOrder.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl transition shadow-lg shadow-emerald-600/25 text-sm active:scale-95"
                >
                  <Send className="w-4.5 h-4.5" />
                  Enviar Comprobante y Ubicación por WhatsApp
                </a>

                {completedOrder.pdfBase64 && (
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-2xl transition border border-slate-200 text-xs"
                  >
                    <FileDown className="w-4 h-4" />
                    Descargar Nota de Entrega / Comprobante (PDF)
                  </button>
                )}
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-slate-600 mb-1">Tu carrito está vacío</p>
              <p className="text-xs">Agrega productos del catálogo para continuar</p>
            </div>
          ) : (
            <>
              {/* Items List */}
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex-1 pr-2">
                      <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{item.title}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-slate-400">SKU: {item.sku}</span>
                        <span className="text-xs font-bold text-emerald-700">{formatPrice(item.price, currency)}</span>
                        {showVES && exchangeRateVES > 0 && (
                          <span className="text-[10px] text-slate-500 font-mono font-bold">
                            (Bs. {(item.price * exchangeRateVES).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 rounded-lg text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-4 text-center text-xs font-black text-slate-900">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 rounded-lg text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Customer Checkout Form */}
              <form id="checkout-form" onSubmit={handleCheckout} className="space-y-4 pt-4 border-t border-slate-100">
                {/* Honeypot anti-bot (Sprint 5): invisible para humanos y
                    lectores de pantalla; un bot que autorrellena todo campo
                    lo llena y el servidor rechaza en silencio. */}
                <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
                  <label htmlFor="website-field">Sitio web</label>
                  <input
                    id="website-field"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypotWebsite}
                    onChange={(e) => setHoneypotWebsite(e.target.value)}
                  />
                </div>
                {/* 1. Modalidad de Entrega (Delivery vs Pickup) */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-2">
                    Tipo de Entrega:
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setDeliveryType('delivery')}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
                        deliveryType === 'delivery'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                      <span>🚚 Delivery</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryType('pickup')}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
                        deliveryType === 'pickup'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Store className="w-4 h-4" />
                      <span>🏪 Retiro (Pickup)</span>
                    </button>
                  </div>
                </div>

                {/* 2. Pickup Venezuelan Store Address & Schedule Card */}
                {deliveryType === 'pickup' ? (
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-slate-800 space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                          Dirección de Retiro en Tienda:
                        </h5>
                        <p className="text-xs text-slate-700 font-medium leading-relaxed mt-0.5">
                          {pickupLoc}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-amber-200/60 text-xs text-slate-600 font-semibold">
                      <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>Horario de Retiro: {pickupSched}</span>
                    </div>

                    <p className="text-[11px] text-amber-800 font-medium bg-amber-100/60 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 flex-shrink-0" />
                      Tu pedido estará listo para retirar en {pickupTime} tras confirmación por WhatsApp.
                    </p>
                  </div>
                ) : (
                  /* 3. Delivery Required Fields (3 Fields: Dirección o zona, Edificio o casa, Municipios) */
                  <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 animate-in fade-in duration-200">
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      Datos de Dirección para el Delivery
                    </h5>

                    {/* Campo 1: Dirección o zona */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Dirección o zona *
                      </label>
                      <input
                        type="text"
                        required={deliveryType === 'delivery'}
                        placeholder="Ej. Los Palos Grandes, Av. Francisco de Miranda"
                        value={customer.address}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, address: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium shadow-xs"
                      />
                    </div>

                    {/* Campo 2: Edificio o casa */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Edificio, casa, piso o apto *
                      </label>
                      <input
                        type="text"
                        required={deliveryType === 'delivery'}
                        placeholder="Ej. Res. Parque Ávila, Torre B, Apto 4-B"
                        value={customer.buildingHouse}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, buildingHouse: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium shadow-xs"
                      />
                    </div>

                    {/* Campo 3: Municipios de Caracas */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Municipio de Entrega *
                      </label>
                      <select
                        value={customer.municipality}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, municipality: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold shadow-xs"
                      >
                        {deliveryConfig?.zones && deliveryConfig.zones.length > 0 ? (
                          deliveryConfig.zones.map((zone) => (
                            <option key={zone.name} value={zone.name}>
                              {zone.name} {zone.priceDelivery ? `(+$${Number(zone.priceDelivery).toFixed(2)})` : ''}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="Municipio Chacao">Municipio Chacao</option>
                            <option value="Municipio Baruta">Municipio Baruta</option>
                            <option value="Municipio Sucre (Petare / Los Dos Caminos)">Municipio Sucre</option>
                            <option value="Municipio El Hatillo">Municipio El Hatillo</option>
                            <option value="Municipio Libertador (Centro / Oeste)">Municipio Libertador</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                )}

                {/* 4. Datos del Cliente */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Datos del Comprador
                  </h4>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Juan Pérez"
                      value={customer.name}
                      onChange={(e) => setCustomer((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Teléfono WhatsApp *
                    </label>
                    <div className="flex items-center gap-1.5">
                      {/* Fixed Venezuelan Prefix */}
                      <span className="px-2.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1 flex-shrink-0 select-none shadow-xs">
                        <span>🇻🇪</span>
                        <span>+58</span>
                      </span>

                      {/* Operator Code Selector */}
                      <select
                        value={phoneOperator}
                        onChange={(e) => setPhoneOperator(e.target.value)}
                        className="px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 flex-shrink-0"
                      >
                        <option value="414">0414</option>
                        <option value="424">0424</option>
                        <option value="412">0412</option>
                        <option value="416">0416</option>
                        <option value="426">0426</option>
                      </select>

                      {/* 7-digit Phone Number Input */}
                      <input
                        type="tel"
                        required
                        maxLength={8}
                        placeholder="123 4567"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Recibirás la confirmación de tu pedido al WhatsApp: +58 ({phoneOperator}) {phoneNumber || '...'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico (para recibir comprobante y PDF)</label>
                    <input
                      type="email"
                      required
                      placeholder="tucorreo@ejemplo.com"
                      value={customer.email}
                      onChange={(e) => setCustomer((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                    />
                  </div>
                </div>

                {/* 5. Selector de Métodos de Pago Venezolanos y Multidivisa */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                      Método de Pago:
                    </label>
                    {showVES && exchangeRateVES > 0 && (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Tasa: {exchangeRateVES.toFixed(2)} Bs/$
                      </span>
                    )}
                  </div>

                  {/* Payment Methods Grid — PR 12: data-driven (payment-methods.tsx) */}
                  <PaymentMethodGrid buttons={methodButtons} selected={paymentMethodKey} onSelect={setPaymentMethodKey} />

                  {/* Cards de cuenta del método — PR 12: data-driven (payment-methods.tsx) */}
                  {selectedAccountCard && (
                    <AccountCard card={selectedAccountCard} copiedKey={copiedKey} onCopy={handleCopyText} />
                  )}

                  {paymentMethodKey === 'cash' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-1 text-xs text-emerald-950 shadow-xs">
                      <div className="flex items-center gap-2 font-bold text-emerald-900">
                        <DollarSign className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Pago en Efectivo (Dólares o Bolívares)</span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        Ten a mano los billetes exactos (sin roturas ni tachaduras). Por políticas de seguridad, por favor envía una foto clara de los billetes por WhatsApp al finalizar el pedido.
                      </p>
                    </div>
                  )}

                  {paymentMethodKey === 'pos' && (
                    <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3.5 space-y-1 text-xs text-slate-800 shadow-xs">
                      <div className="flex items-center gap-2 font-bold text-slate-900">
                        <CreditCard className="w-4 h-4 text-slate-600 flex-shrink-0" />
                        <span>Punto de Venta / Tarjeta en Tienda</span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        Puedes cancelar con tu tarjeta de débito o crédito directamente en caja al momento de retirar tu orden en nuestro establecimiento.
                      </p>
                    </div>
                  )}

                    {/* Formularios de verificación — PR 12: data-driven (payment-methods.tsx) */}
                    {selectedVerificationForm && (
                      <VerificationForm
                        form={selectedVerificationForm}
                        state={paymentVerification}
                        onChange={handleVerificationChange}
                      />
                    )}

                    <WhatsAppProofCallout />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Notas Adicionales</label>
                  <textarea
                    rows={2}
                    placeholder="Instrucciones especiales para la entrega o preparación..."
                    value={customer.notes}
                    onChange={(e) => setCustomer((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs font-medium"
                  />
                </div>

                {/* Consentimiento de privacidad (auditoría 2026-09-04, P1):
                    el checkout recolecta PII (nombre, teléfono, email,
                    dirección) sin aviso previo. Checkbox obligatorio antes del
                    submit con enlace al aviso completo. */}
                <label className="flex items-start gap-2 text-[11px] text-slate-600 leading-snug pt-1">
                  <input
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                    className="mt-0.5 accent-emerald-600 flex-shrink-0"
                  />
                  <span>
                    Acepto que la tienda trate mis datos (nombre, teléfono, correo y dirección) para
                    gestionar este pedido, conforme al{' '}
                    <a
                      href="/privacidad"
                      target="_blank"
                      rel="noreferrer"
                      className="underline font-semibold text-emerald-700"
                    >
                      Aviso de Privacidad
                    </a>
                    . Parte de la información se comparte vía WhatsApp y con el operador de despacho
                    de la tienda.
                  </span>
                </label>
              </form>
            </>
          )}
        </div>

        {/* Footer Checkout Bar */}
        {!completedOrder && items.length > 0 && (
          <div className="p-4 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] sm:pb-4 border-t border-slate-100 bg-slate-50 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
            {deliveryFee > 0 && (
              <div className="space-y-1 mb-2.5 pb-2 border-b border-slate-200/80 text-xs">
                <div className="flex items-center justify-between text-slate-500 font-medium">
                  <span>Subtotal Productos:</span>
                  <span className="font-mono text-slate-800 font-bold">{formatPrice(itemsSubtotal, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 font-medium">
                  <span>Tarifa Delivery:</span>
                  <span className="font-mono text-emerald-600 font-bold">+{formatPrice(deliveryFee, currency)}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-bold text-slate-500 block">Total a Pagar:</span>
                {showVES && (
                  <span className="text-xs text-slate-600 font-mono font-bold">
                    Bs. {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <span className="text-2xl font-black text-slate-950">{formatPrice(total, currency)}</span>
            </div>

            <button
              type="submit"
              form="checkout-form"
              disabled={isLoading || preview}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-2xl transition shadow-lg shadow-emerald-600/25 active:scale-95 text-sm"
            >
              <Send className="w-4 h-4" />
              {preview
                ? 'Vista previa — pedidos desactivados'
                : isLoading
                ? 'Procesando Pedido...'
                : 'Confirmar y Enviar a WhatsApp'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

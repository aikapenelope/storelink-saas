'use client';

import React, { useState } from 'react';
import {
  ShoppingBag,
  Trash2,
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
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { ProductItem } from '@/components/product-card';
import { processOrder } from '@/app/actions/checkout';

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
  tenantSlug: string;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onClearCart: () => void;
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  currency = 'USD',
  exchangeRateVES = 910.0,
  showVES = true,
  storeName,
  whatsappPhone,
  tenantSlug,
  onUpdateQuantity,
  onClearCart,
}: CartDrawerProps) {
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [phoneOperator, setPhoneOperator] = useState('414');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    address: '',
    residenceZone: '',
    buildingHouse: '',
    municipality: 'Chacao',
    paymentMethod: 'Transferencia / Pago Móvil / Efectivo',
    notes: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{
    orderNumber: string;
    whatsappUrl: string;
    pdfBase64?: string;
  } | null>(null);

  const total = items.reduce((acc, item) => acc + item.quantity * item.price, 0);
  const totalVES = total * exchangeRateVES;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer.name.trim()) {
      alert('Por favor ingresa tu nombre completo.');
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
        !customer.residenceZone.trim() ||
        !customer.buildingHouse.trim() ||
        !customer.municipality.trim()
      ) {
        alert('Por favor completa todos los campos obligatorios de la dirección de delivery.');
        return;
      }
    }

    setIsLoading(true);

    const formattedAddress =
      deliveryType === 'delivery'
        ? `[DELIVERY] ${customer.address}, Edif/Casa: ${customer.buildingHouse}, Zona/Sector: ${customer.residenceZone}, Mun: ${customer.municipality}`
        : `[RETIRO EN TIENDA / PICKUP] Sede Don Luigi - Las Mercedes, Caracas (Horario: 11:30 AM - 10:00 PM)`;

    try {
      const response = await processOrder({
        tenantSlug,
        storeName,
        whatsappPhone,
        currency,
        exchangeRateVES,
        showVES,
        customer: {
          name: customer.name,
          phone: fullFormattedPhone,
          email: customer.email,
          address: formattedAddress,
          paymentMethod: customer.paymentMethod,
          notes: customer.notes,
        },
        items: items.map((i) => ({
          sku: i.sku,
          title: i.title,
          quantity: i.quantity,
          price: i.price,
        })),
      });

      if (response.success && response.whatsappUrl && response.orderNumber) {
        setCompletedOrder({
          orderNumber: response.orderNumber,
          whatsappUrl: response.whatsappUrl,
          pdfBase64: response.pdfBase64,
        });

        // Open WhatsApp directly in new window / app
        window.open(response.whatsappUrl, '_blank');
        onClearCart();
      } else {
        alert(response.error || 'Hubo un error al procesar el pedido.');
      }
    } catch (err: any) {
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
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex justify-end">
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
            <div className="py-8 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-1">¡Pedido Listo!</h3>
              <p className="text-xs text-slate-400 font-mono mb-4">N° #{completedOrder.orderNumber}</p>
              <p className="text-slate-600 text-sm mb-6 max-w-xs leading-relaxed">
                Se ha generado la orden y actualizado el inventario. Si no se abrió WhatsApp automáticamente, pulsa el botón abajo.
              </p>

              <div className="w-full space-y-3">
                <a
                  href={completedOrder.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl transition shadow-lg shadow-emerald-600/25"
                >
                  <Send className="w-4 h-4" />
                  Abrir Pedido en WhatsApp
                </a>

                {completedOrder.pdfBase64 && (
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-2xl transition border border-slate-200"
                  >
                    <FileDown className="w-4 h-4" />
                    Descargar Comprobante / Nota (PDF)
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
                        {showVES && (
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
                          Av. Principal de Las Mercedes con Calle París, Edificio Don Luigi, Planta Baja (frente a la Plaza Alfredo Sadel), Caracas, Venezuela.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-amber-200/60 text-xs text-slate-600 font-semibold">
                      <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>Horario de Retiro: Lunes a Domingo de 11:30 AM a 10:00 PM</span>
                    </div>

                    <p className="text-[11px] text-amber-800 font-medium bg-amber-100/60 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 flex-shrink-0" />
                      Tu pedido estará listo para retirar en 20-30 min tras confirmación por WhatsApp.
                    </p>
                  </div>
                ) : (
                  /* 3. Delivery Required Fields */
                  <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 animate-in fade-in duration-200">
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      Datos de Dirección para el Delivery
                    </h5>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Dirección exacta / Calle o Avenida *
                      </label>
                      <input
                        type="text"
                        required={deliveryType === 'delivery'}
                        placeholder="Ej. Av. Francisco de Miranda, Calle El Recreo"
                        value={customer.address}
                        onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Zona de Residencia / Sector *
                        </label>
                        <input
                          type="text"
                          required={deliveryType === 'delivery'}
                          placeholder="Ej. Los Palos Grandes, Altamira, Las Mercedes"
                          value={customer.residenceZone}
                          onChange={(e) => setCustomer({ ...customer, residenceZone: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Edificio / Casa / Apto / Piso *
                        </label>
                        <input
                          type="text"
                          required={deliveryType === 'delivery'}
                          placeholder="Ej. Edif. Ávila, Piso 4, Apto 4-B"
                          value={customer.buildingHouse}
                          onChange={(e) => setCustomer({ ...customer, buildingHouse: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Municipio *
                      </label>
                      <select
                        value={customer.municipality}
                        onChange={(e) => setCustomer({ ...customer, municipality: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-medium"
                      >
                        <option value="Chacao">Municipio Chacao</option>
                        <option value="Baruta">Municipio Baruta</option>
                        <option value="Sucre">Municipio Sucre (Petare / Los Dos Caminos)</option>
                        <option value="El Hatillo">Municipio El Hatillo</option>
                        <option value="Libertador">Municipio Libertador (Caracas Centro / Oeste)</option>
                        <option value="Otro Municipio">Otro Municipio / Fuera de Caracas</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* 4. Datos del Cliente */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Datos del Comprador
                  </h4>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Juan Pérez"
                      value={customer.name}
                      onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
                        className="px-2.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 flex-shrink-0"
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
                        className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
                      placeholder="tucorreo@ejemplo.com (opcional)"
                      value={customer.email}
                      onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Método de Pago Preferido</label>
                    <select
                      value={customer.paymentMethod}
                      onChange={(e) => setCustomer({ ...customer, paymentMethod: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-medium"
                    >
                      <option value="Pago Móvil / Transferencia en Bolívares (VES)">Pago Móvil / Transferencia en Bolívares (VES)</option>
                      <option value="Dólares en Efectivo al Recibir (USD)">Dólares en Efectivo al Recibir (USD)</option>
                      <option value="Zelle / Binance USDT">Zelle / Binance USDT</option>
                      <option value="Punto de Venta / Tarjeta en Local">Punto de Venta / Tarjeta en Local</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Notas Adicionales</label>
                    <textarea
                      rows={2}
                      placeholder="Instrucciones especiales para la entrega o preparación..."
                      value={customer.notes}
                      onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer Checkout Bar */}
        {!completedOrder && items.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50">
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
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-2xl transition shadow-lg shadow-emerald-600/25 active:scale-95"
            >
              <Send className="w-4 h-4" />
              {isLoading ? 'Procesando Pedido...' : 'Confirmar y Enviar a WhatsApp'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

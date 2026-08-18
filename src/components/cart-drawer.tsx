'use client';

import React, { useState } from 'react';
import { ShoppingBag, Trash2, Plus, Minus, Send, FileDown, CheckCircle2, X } from 'lucide-react';
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
  storeName: string;
  whatsappPhone: string;
  tenantSlug: string;
  trelloConfig?: {
    apiKey?: string;
    token?: string;
    listId?: string;
  };
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onClearCart: () => void;
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  currency = 'USD',
  storeName,
  whatsappPhone,
  tenantSlug,
  trelloConfig,
  onUpdateQuantity,
  onClearCart,
}: CartDrawerProps) {
  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    address: '',
    paymentMethod: 'Transferencia / Efectivo',
    notes: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{
    orderNumber: string;
    whatsappUrl: string;
    pdfBase64?: string;
  } | null>(null);

  const total = items.reduce((acc, item) => acc + item.quantity * item.price, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer.name.trim() || !customer.phone.trim()) {
      alert('Por favor ingresa tu nombre y número de teléfono para el pedido.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await processOrder({
        tenantSlug,
        storeName,
        whatsappPhone,
        currency,
        trelloConfig,
        customer,
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
      <div className="bg-white w-full max-w-md h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-green-600" />
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
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-1">¡Pedido Listo!</h3>
              <p className="text-xs text-slate-400 font-mono mb-4">N° #{completedOrder.orderNumber}</p>
              <p className="text-slate-600 text-sm mb-6 max-w-xs">
                Se ha generado el resumen y la nota de entrega. Si no se abrió WhatsApp automáticamente, pulsa el botón verde abajo.
              </p>

              <div className="w-full space-y-3">
                <a
                  href={completedOrder.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-2xl transition shadow-lg shadow-green-600/25"
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
                    Descargar Nota de Entrega (PDF)
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
                        <span className="text-xs font-bold text-green-700">{formatPrice(item.price, currency)}</span>
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
              <form id="checkout-form" onSubmit={handleCheckout} className="space-y-3 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Datos para la Entrega</h4>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez"
                    value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ej. +34 600 123 456"
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dirección de Entrega</label>
                  <input
                    type="text"
                    placeholder="Calle, Edificio, Apto (opcional)"
                    value={customer.address}
                    onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Método de Pago Preferido</label>
                  <select
                    value={customer.paymentMethod}
                    onChange={(e) => setCustomer({ ...customer, paymentMethod: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 bg-white"
                  >
                    <option value="Transferencia Bancaria">Transferencia Bancaria / Móvil</option>
                    <option value="Efectivo en Entrega">Efectivo al recibir</option>
                    <option value="Pago Digital (Zelle / Bizum / PayPal)">Pago Digital (Zelle / Bizum / PayPal)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Notas Adicionales</label>
                  <textarea
                    rows={2}
                    placeholder="Instrucciones especiales para el pedido..."
                    value={customer.notes}
                    onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  />
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer Checkout Bar */}
        {!completedOrder && items.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-500">Total a Pagar:</span>
              <span className="text-xl font-black text-slate-900">{formatPrice(total, currency)}</span>
            </div>

            <button
              type="submit"
              form="checkout-form"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-2xl transition shadow-lg shadow-green-600/25"
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

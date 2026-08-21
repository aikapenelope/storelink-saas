'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Truck,
  PackageCheck,
  XCircle,
  MessageCircle,
  ExternalLink,
  Download,
  Filter,
  Eye,
  Check,
  X,
  CreditCard,
} from 'lucide-react';

interface OrderItem {
  sku?: string;
  title: string;
  price: number;
  quantity: number;
  subtotal?: number;
}

interface Order {
  id: string | number;
  orderNumber: string;
  createdAt: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'in_delivery' | 'delivered' | 'cancelled' | string;
  deliveryType?: 'delivery' | 'pickup' | string;
  totalAmount?: number;
  total?: number;
  currency?: string;
  customer?: {
    name?: string;
    phone?: string;
    address?: string;
    paymentMethod?: string;
    notes?: string;
  };
  customerName?: string;
  paymentDetails?: {
    methodKey?: string;
    referenceNumber?: string;
    paymentStatus?: 'pending_verification' | 'verified' | 'rejected' | string;
    issuingBank?: string;
    senderName?: string;
  };
  items?: OrderItem[];
}

interface DashboardOrdersManagerProps {
  initialOrders: Order[];
  tenantSlug: string;
  tenantName: string;
  rateVES: number;
}

export function DashboardOrdersManager({
  initialOrders,
  tenantSlug,
  tenantName,
  rateVES,
}: DashboardOrdersManagerProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filteredOrders = orders.filter((o) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'pending') return !o.status || o.status === 'pending';
    return o.status === activeFilter;
  });

  const handleUpdateStatus = async (orderId: string | number, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Error al actualizar');

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err: any) {
      alert(`Error actualizando estado: ${err.message || 'Error de conexión'}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleVerifyPayment = async (orderId: string | number, paymentStatus: 'verified' | 'rejected') => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus }),
      });

      if (!res.ok) throw new Error('Error al verificar pago');

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                paymentDetails: {
                  ...(o.paymentDetails || {}),
                  paymentStatus,
                },
              }
            : o
        )
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                paymentDetails: {
                  ...(prev.paymentDetails || {}),
                  paymentStatus,
                },
              }
            : null
        );
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExportCSV = () => {
    if (orders.length === 0) {
      alert('No hay pedidos para exportar.');
      return;
    }

    const headers = [
      'Numero_Pedido',
      'Fecha',
      'Estado',
      'Cliente',
      'Telefono',
      'Direccion',
      'Modalidad',
      'Metodo_Pago',
      'Referencia',
      'Total_USD',
      'Total_VES',
      'Items',
    ];

    const rows = [headers.join(',')];

    orders.forEach((o) => {
      const totalUSD = Number(o.totalAmount || o.total || 0);
      const totalVESOrder = totalUSD * rateVES;
      const itemsStr = Array.isArray(o.items)
        ? o.items.map((i) => `${i.quantity}x ${i.title} ($${i.price})`).join(' | ')
        : '';

      const row = [
        `"${o.orderNumber || o.id}"`,
        `"${o.createdAt ? new Date(o.createdAt).toLocaleString('es-VE') : ''}"`,
        `"${o.status || 'pending'}"`,
        `"${(o.customer?.name || o.customerName || '').replace(/"/g, '""')}"`,
        `"${(o.customer?.phone || '').replace(/"/g, '""')}"`,
        `"${(o.customer?.address || '').replace(/"/g, '""')}"`,
        `"${o.deliveryType || 'delivery'}"`,
        `"${(o.paymentDetails?.methodKey || o.customer?.paymentMethod || '').replace(/"/g, '""')}"`,
        `"${(o.paymentDetails?.referenceNumber || '').replace(/"/g, '""')}"`,
        `"${totalUSD.toFixed(2)}"`,
        `"${totalVESOrder.toFixed(2)}"`,
        `"${itemsStr.replace(/"/g, '""')}"`,
      ];
      rows.push(row.join(','));
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pedidos_${tenantSlug}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-2 py-0.5 bg-blue-950/60 border border-blue-700 text-blue-300 font-mono text-[10px] rounded-none">Confirmado</span>;
      case 'preparing':
        return <span className="px-2 py-0.5 bg-amber-950/60 border border-amber-700 text-amber-300 font-mono text-[10px] rounded-none">En Preparación</span>;
      case 'in_delivery':
        return <span className="px-2 py-0.5 bg-purple-950/60 border border-purple-700 text-purple-300 font-mono text-[10px] rounded-none">En Delivery</span>;
      case 'delivered':
        return <span className="px-2 py-0.5 bg-emerald-950/60 border border-emerald-700 text-emerald-300 font-mono text-[10px] rounded-none">Completado</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 bg-red-950/60 border border-red-800 text-red-400 font-mono text-[10px] rounded-none">Cancelado</span>;
      default:
        return <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono text-[10px] rounded-none">Pendiente</span>;
    }
  };

  return (
    <div className="border border-zinc-800 bg-zinc-950 overflow-hidden shadow-xl rounded-none font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-800 p-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
            Control de Pedidos en Vivo
          </p>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Gestión y Confirmación de Pedidos</span>
            <span className="text-xs font-mono text-zinc-400 font-normal">({orders.length} totales)</span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter tabs */}
          <div className="flex border border-zinc-800 bg-black p-0.5 rounded-none overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 text-[11px] font-mono transition rounded-none ${
                activeFilter === 'all' ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Todos ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('pending')}
              className={`px-2.5 py-1 text-[11px] font-mono transition rounded-none ${
                activeFilter === 'pending' ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Pendientes
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('confirmed')}
              className={`px-2.5 py-1 text-[11px] font-mono transition rounded-none ${
                activeFilter === 'confirmed' ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Confirmados
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('delivered')}
              className={`px-2.5 py-1 text-[11px] font-mono transition rounded-none ${
                activeFilter === 'delivered' ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Entregados
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-mono transition inline-flex items-center gap-1.5 rounded-none cursor-pointer"
            title="Exportar pedidos para Google Sheets o Excel"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span>Descargar CSV</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      {filteredOrders.length === 0 ? (
        <div className="p-10 text-center text-xs text-zinc-500 font-mono">
          <p>No hay pedidos con el estado seleccionado ({activeFilter}).</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-black text-[10px] uppercase tracking-[0.14em] text-zinc-400 font-mono">
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Modalidad</th>
                <th className="px-4 py-3">Monto</th>
                <th className="px-4 py-3">Pago / Ref</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones Rápidas</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const totalUSD = Number(order.totalAmount || order.total) || 0;
                const totalVESOrder = totalUSD * rateVES;
                const orderNum = order.orderNumber || order.id?.toString().slice(-4) || '1001';
                const customerName = order.customerName || order.customer?.name || 'Cliente';
                const customerPhone = order.customer?.phone || '';
                const cleanPhone = customerPhone.replace(/\D/g, '');
                const status = order.status || 'pending';
                const paymentStatus = order.paymentDetails?.paymentStatus || 'pending_verification';
                const paymentMethod = order.paymentDetails?.methodKey || order.customer?.paymentMethod || 'No esp.';
                const refNum = order.paymentDetails?.referenceNumber;

                const prefilledMsg = encodeURIComponent(
                  `¡Hola ${customerName}! Te escribimos de ${tenantName} respecto a tu pedido #${orderNum}.`
                );

                return (
                  <tr
                    key={order.id}
                    className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40 transition"
                  >
                    {/* Order # */}
                    <td className="px-4 py-3 font-mono">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="font-bold text-white hover:underline text-left cursor-pointer"
                      >
                        #{orderNum}
                      </button>
                      <span className="block text-[10px] text-zinc-500">
                        {order.createdAt ? new Date(order.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white truncate max-w-[140px]">{customerName}</p>
                      {cleanPhone ? (
                        <a
                          href={`https://wa.me/${cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone}`}?text=${prefilledMsg}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-zinc-400 hover:text-white inline-flex items-center gap-1 font-mono"
                        >
                          <MessageCircle className="w-3 h-3 text-emerald-400" />
                          <span>{customerPhone}</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-zinc-600 font-mono">Sin tlf</span>
                      )}
                    </td>

                    {/* Delivery Type */}
                    <td className="px-4 py-3 text-zinc-300">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                        {order.deliveryType === 'delivery' ? (
                          <>
                            <Truck className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Delivery</span>
                          </>
                        ) : (
                          <>
                            <PackageCheck className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Pick-up</span>
                          </>
                        )}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 font-mono">
                      <span className="font-bold text-white text-xs">${totalUSD.toFixed(2)}</span>
                      <span className="block text-[10px] text-zinc-400">
                        Bs. {totalVESOrder.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </span>
                    </td>

                    {/* Payment Info */}
                    <td className="px-4 py-3 font-mono text-[11px]">
                      <span className="text-zinc-300 uppercase block font-semibold">{paymentMethod}</span>
                      {refNum ? (
                        <span className="text-[10px] text-zinc-400 block truncate max-w-[120px]">
                          Ref: <strong className="text-white">{refNum}</strong>
                        </span>
                      ) : null}
                      <span className="text-[9px] mt-0.5 inline-block">
                        {paymentStatus === 'verified' ? (
                          <span className="text-emerald-400 font-bold">✓ Pago Verificado</span>
                        ) : paymentStatus === 'rejected' ? (
                          <span className="text-red-400">✕ Pago Rechazado</span>
                        ) : (
                          <span className="text-amber-400">Por verificar</span>
                        )}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3">
                      {getStatusBadge(status)}
                    </td>

                    {/* Quick Actions */}
                    <td className="px-4 py-3 text-right font-mono">
                      <div className="flex items-center justify-end gap-1.5">
                        {status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(order.id, 'confirmed')}
                            disabled={updatingId === order.id}
                            className="px-2.5 py-1 bg-white hover:bg-zinc-200 text-black font-bold text-[10px] transition rounded-none uppercase cursor-pointer"
                          >
                            Confirmar
                          </button>
                        )}

                        {status === 'confirmed' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(order.id, 'preparing')}
                            disabled={updatingId === order.id}
                            className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-amber-600 text-amber-300 font-bold text-[10px] transition rounded-none uppercase cursor-pointer"
                          >
                            Preparar
                          </button>
                        )}

                        {status === 'preparing' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(order.id, 'in_delivery')}
                            disabled={updatingId === order.id}
                            className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-purple-600 text-purple-300 font-bold text-[10px] transition rounded-none uppercase cursor-pointer"
                          >
                            Despachar
                          </button>
                        )}

                        {status === 'in_delivery' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(order.id, 'delivered')}
                            disabled={updatingId === order.id}
                            className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-emerald-600 text-emerald-300 font-bold text-[10px] transition rounded-none uppercase cursor-pointer"
                          >
                            Completar
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-[10px] transition rounded-none cursor-pointer"
                          title="Ver detalles completos"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl rounded-none max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white font-mono">
                  Detalle del Pedido #{selectedOrder.orderNumber || selectedOrder.id}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString('es-VE') : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer & Delivery */}
            <div className="grid grid-cols-2 gap-3 my-4 p-3 bg-black border border-zinc-800 text-xs">
              <div>
                <span className="text-zinc-500 font-mono block">Cliente</span>
                <span className="font-bold text-white block">{selectedOrder.customer?.name || selectedOrder.customerName}</span>
                <span className="text-zinc-400 font-mono">{selectedOrder.customer?.phone}</span>
              </div>
              <div>
                <span className="text-zinc-500 font-mono block">Modalidad</span>
                <span className="font-bold text-white block uppercase">{selectedOrder.deliveryType || 'Delivery'}</span>
                <span className="text-zinc-400 truncate block">{selectedOrder.customer?.address || 'Retiro en Sede'}</span>
              </div>
            </div>

            {/* Items */}
            <div className="my-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 font-mono">Productos</h4>
              <div className="space-y-1.5 border border-zinc-800 p-3 bg-black text-xs">
                {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b border-zinc-800/60 pb-1.5 last:border-0">
                      <span className="text-white">
                        <strong className="text-zinc-400 font-mono mr-1.5">{item.quantity}x</strong> {item.title}
                      </span>
                      <span className="font-mono text-zinc-300">
                        ${((Number(item.price) || 0) * (Number(item.quantity) || 1)).toFixed(2)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-500">Sin items especificados.</p>
                )}
                <div className="pt-2 border-t border-zinc-800 flex justify-between font-mono font-bold text-sm text-white">
                  <span>Total Pedido:</span>
                  <span>${Number(selectedOrder.totalAmount || selectedOrder.total || 0).toFixed(2)} USD</span>
                </div>
              </div>
            </div>

            {/* Status Change Buttons */}
            <div className="pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleVerifyPayment(selectedOrder.id, 'verified')}
                  className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 text-xs font-mono transition rounded-none cursor-pointer"
                >
                  ✓ Validar Pago
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                  className="px-3 py-1.5 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 text-xs font-mono transition rounded-none cursor-pointer"
                >
                  ✕ Cancelar Orden
                </button>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/orders/${selectedOrder.orderNumber || selectedOrder.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-mono transition inline-flex items-center gap-1.5 rounded-none"
                  title="Ver o imprimir nota de entrega oficial en PDF"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Nota de Entrega (PDF)</span>
                </a>

                <a
                  href={`/admin/collections/orders/${selectedOrder.id}`}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-mono transition inline-flex items-center gap-1 rounded-none"
                >
                  <span>Abrir en Payload</span>
                  <ExternalLink className="w-3 h-3 text-zinc-400" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

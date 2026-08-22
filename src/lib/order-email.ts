/**
 * Plantilla del correo de confirmación de pedido (HTML) con escape de todo
 * dato ingresado por el cliente (patrón A5: previene HTML/phishing injection).
 * Compartida por el job `sendOrderConfirmationEmail` (Jobs Queue oficial).
 */

function escapeHtml(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Neutraliza saltos de línea y caracteres de control para texto plano (WhatsApp) */
export function sanitizePlainText(value: string | undefined | null): string {
  if (!value) return '';
  return value.replace(/[\r\n\t]+/g, ' ').replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

export interface OrderEmailItem {
  sku: string;
  title: string;
  quantity: number;
  price: number;
}

export function buildOrderConfirmationEmailHtml(args: {
  storeName: string;
  customerName: string;
  orderNumber: string;
  deliveryType?: string;
  paymentLabel: string;
  notes?: string;
  items: OrderEmailItem[];
  total: number;
  totalVES: number;
  exchangeRateVES: number;
  showVES?: boolean;
}): string {
  const {
    storeName,
    customerName,
    orderNumber,
    deliveryType,
    paymentLabel,
    notes,
    items,
    total,
    totalVES,
    exchangeRateVES,
    showVES,
  } = args;

  const itemsHtml = items
    .map(
      (i) =>
        `<tr>
          <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;"><strong>[${escapeHtml(i.sku || 'N/A')}]</strong> ${escapeHtml(i.title)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: center;">${i.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: bold;">$${(i.quantity * i.price).toFixed(2)}</td>
        </tr>`
    )
    .join('');

  const safeNotes = sanitizePlainText(notes);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #1e293b; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .store-name { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; margin: 0 0 6px 0; color: #ffffff; }
        .badge { display: inline-block; background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; }
        .body-content { padding: 28px 24px; }
        .greeting { font-size: 16px; line-height: 1.6; color: #334155; margin-bottom: 20px; }
        .order-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin: 20px 0; font-size: 13px; }
        .order-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .order-row:last-child { margin-bottom: 0; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
        .th { background: #f1f5f9; padding: 10px; text-align: left; font-weight: 700; color: #475569; font-size: 11px; text-transform: uppercase; }
        .total-box { text-align: right; padding-top: 14px; border-top: 2px solid #e2e8f0; }
        .total-usd { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; }
        .total-ves { font-size: 13px; color: #059669; font-weight: 700; margin: 4px 0 0 0; }
        .next-steps { background: #fffbeb; border: 1px solid #fef3c7; border-radius: 14px; padding: 16px; margin-top: 24px; }
        .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="store-name">${escapeHtml(storeName)}</h1>
          <span class="badge">Pedido Registrado</span>
        </div>
        <div class="body-content">
          <p class="greeting">¡Hola <strong>${escapeHtml(customerName)}</strong>! Hemos registrado tu pedido con éxito.</p>
          <div class="order-box">
            <div class="order-row"><span style="color: #64748b;">N° Pedido:</span><strong>#${orderNumber}</strong></div>
            <div class="order-row"><span style="color: #64748b;">Modalidad:</span><strong>${deliveryType === 'pickup' ? 'Retiro en Tienda (Pickup)' : 'Delivery'}</strong></div>
            <div class="order-row"><span style="color: #64748b;">Método de Pago:</span><strong>${escapeHtml(paymentLabel)}</strong></div>
            ${safeNotes ? `<div class="order-row"><span style="color: #64748b;">Nota:</span><em>${escapeHtml(safeNotes)}</em></div>` : ''}
          </div>
          <table class="table">
            <thead>
              <tr><th class="th">Producto</th><th class="th" style="text-align: center;">Cant.</th><th class="th" style="text-align: right;">Total</th></tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="total-box">
            <p class="total-usd">Total: $${total.toFixed(2)} USD</p>
            ${showVES ? `<p class="total-ves">Equivalente VES: Bs. ${totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa: ${exchangeRateVES.toFixed(2)} Bs/$)</p>` : ''}
          </div>
          <div class="next-steps">
            <strong style="color: #92400e; font-size: 13px;">💡 Pasos para agilizar tu entrega:</strong>
            <p style="margin: 6px 0 0 0; font-size: 12px; color: #78350f; line-height: 1.5;">
              Por favor envía tu captura de pago / foto de billetes y comparte tu <strong>ubicación en tiempo real por WhatsApp</strong> para coordinar el despacho de inmediato.
            </p>
          </div>
          <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 24px;">
            📎 <em>Hemos adjuntado tu <strong>Nota de Entrega en PDF</strong> a este correo.</em>
          </p>
        </div>
        <div class="footer">
          Generado electrónicamente por <strong>${escapeHtml(storeName)}</strong> en Flow • Caracas, Venezuela
        </div>
      </div>
    </body>
    </html>
  `;
}
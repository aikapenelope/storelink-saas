import { jsPDF } from 'jspdf';

export interface OrderPDFData {
  storeName: string;
  orderNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  paymentMethod?: string;
  notes?: string;
  currency: string;
  total: number;
  totalVES?: number;
  exchangeRateVES?: number;
  showVES?: boolean;
  items: Array<{
    sku: string;
    title: string;
    quantity: number;
    price: number;
  }>;
}

export function generateDeliveryNotePDF(data: OrderPDFData): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const {
    storeName,
    orderNumber,
    date,
    customerName,
    customerPhone,
    customerAddress,
    paymentMethod,
    notes,
    currency,
    total,
    totalVES,
    exchangeRateVES,
    showVES = true,
    items,
  } = data;

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // ── 1. Top Brand Header Bar ──────────────────────────────────────────
  // Gradient top accent line (Emerald)
  doc.setFillColor(16, 185, 129); // #10b981
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Main Header Background (Dark Slate #0f172a)
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 4, pageWidth, 30, 'F');

  // Store Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text((storeName || 'DON LUIGI & BURGERS').toUpperCase(), margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('CATÁLOGO ONLINE & SISTEMA DE GESTIÓN PWA', margin, 24);

  // Document Badge (Right Header)
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.roundedRect(pageWidth - margin - 65, 9, 65, 20, 3, 3, 'F');
  doc.setDrawColor(51, 65, 85);
  doc.roundedRect(pageWidth - margin - 65, 9, 65, 20, 3, 3, 'D');

  doc.setTextColor(52, 211, 153); // Emerald 400
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('COMPROBANTE DE PEDIDO', pageWidth - margin - 61, 15);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10.5);
  doc.text(`#${orderNumber}`, pageWidth - margin - 61, 22);

  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(date, pageWidth - margin - 61, 26.5);

  // ── 2. Client & Order Information Card ────────────────────────────────
  let currentY = 40;

  doc.setFillColor(248, 250, 252); // Slate 50
  doc.roundedRect(margin, currentY, contentWidth, 38, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(margin, currentY, contentWidth, 38, 3, 3, 'D');

  // Card Header
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.roundedRect(margin, currentY, contentWidth, 8, 3, 3, 'F');
  doc.rect(margin, currentY + 4, contentWidth, 4, 'F'); // square bottom corners of top header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('DETALLES DEL CLIENTE Y DESPACHO', margin + 4, currentY + 5.5);

  // Left Column: Customer details
  const colLeftX = margin + 4;
  const colRightX = margin + 95;
  const row1Y = currentY + 14;
  const row2Y = currentY + 21;
  const row3Y = currentY + 28;
  const row4Y = currentY + 34;

  // Row 1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Cliente:', colLeftX, row1Y);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(customerName.substring(0, 38), colLeftX + 15, row1Y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('Método de Pago:', colRightX, row1Y);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.text((paymentMethod || 'Efectivo / Transferencia').substring(0, 38), colRightX + 26, row1Y);

  // Row 2
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('Teléfono:', colLeftX, row2Y);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(customerPhone, colLeftX + 15, row2Y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('Estado:', colRightX, row2Y);
  doc.setTextColor(217, 119, 6); // Amber 600
  doc.setFont('helvetica', 'bold');
  doc.text('Pendiente de Verificación', colRightX + 26, row2Y);

  // Row 3: Address / Delivery Modality
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('Modalidad:', colLeftX, row3Y);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  const cleanAddress = customerAddress || 'Retiro en Tienda / Pickup';
  doc.text(cleanAddress.substring(0, 78), colLeftX + 18, row3Y);

  // Row 4: Notes (if present)
  if (notes) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Observación:', colLeftX, row4Y);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'italic');
    doc.text(notes.substring(0, 78), colLeftX + 22, row4Y);
  }

  // ── 3. Items Table Header ─────────────────────────────────────────────
  currentY = 84;

  const colW = {
    sku: 28,
    desc: 86,
    qty: 20,
    price: 24,
    total: 24,
  };

  doc.setFillColor(15, 23, 42); // Slate 900
  doc.roundedRect(margin, currentY, contentWidth, 8, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);

  let curX = margin;
  doc.text('SKU / CÓDIGO', curX + 3, currentY + 5.5);
  curX += colW.sku;
  doc.text('DESCRIPCIÓN DEL PRODUCTO', curX + 3, currentY + 5.5);
  curX += colW.desc;
  doc.text('CANT.', curX + colW.qty / 2, currentY + 5.5, { align: 'center' });
  curX += colW.qty;
  doc.text('PRECIO UNIT.', curX + colW.price - 3, currentY + 5.5, { align: 'right' });
  curX += colW.price;
  doc.text('IMPORTE', curX + colW.total - 3, currentY + 5.5, { align: 'right' });

  // ── 4. Table Rows (Zebra Striping) ────────────────────────────────────
  currentY += 9;
  doc.setFontSize(8.5);

  items.forEach((item, index) => {
    const isEven = index % 2 === 0;
    const rowHeight = 8.5;

    // Zebra fill
    if (!isEven) {
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.rect(margin, currentY - 1.5, contentWidth, rowHeight, 'F');
    }

    // SKU
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text((item.sku || 'S/N').substring(0, 14), margin + 3, currentY + 4);

    // Title
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(item.title.substring(0, 48), margin + colW.sku + 3, currentY + 4);

    // Quantity (Centered)
    doc.setFont('helvetica', 'bold');
    doc.text(String(item.quantity), margin + colW.sku + colW.desc + colW.qty / 2, currentY + 4, { align: 'center' });

    // Price (Right)
    doc.setFont('helvetica', 'normal');
    doc.text(`$${item.price.toFixed(2)}`, margin + colW.sku + colW.desc + colW.qty + colW.price - 3, currentY + 4, { align: 'right' });

    // Total (Right)
    const lineTotal = item.quantity * item.price;
    doc.setFont('helvetica', 'bold');
    doc.text(`$${lineTotal.toFixed(2)}`, margin + contentWidth - 3, currentY + 4, { align: 'right' });

    // Bottom row separator
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + rowHeight - 1.5, margin + contentWidth, currentY + rowHeight - 1.5);

    currentY += rowHeight;
  });

  // ── 5. Totals & Multi-Currency Card ───────────────────────────────────
  currentY += 4;
  const totalsBoxWidth = 84;
  const totalsBoxX = margin + contentWidth - totalsBoxWidth;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(totalsBoxX, currentY, totalsBoxWidth, showVES && totalVES ? 28 : 18, 3, 3, 'F');
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.roundedRect(totalsBoxX, currentY, totalsBoxWidth, showVES && totalVES ? 28 : 18, 3, 3, 'D');

  // Subtotal line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal:', totalsBoxX + 5, currentY + 7);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(`$${total.toFixed(2)} ${currency}`, totalsBoxX + totalsBoxWidth - 5, currentY + 7, { align: 'right' });

  // Main Total Line
  doc.setDrawColor(226, 232, 240);
  doc.line(totalsBoxX + 4, currentY + 10, totalsBoxX + totalsBoxWidth - 4, currentY + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL A PAGAR:', totalsBoxX + 5, currentY + 16);
  doc.setTextColor(16, 185, 129); // Emerald 600
  doc.text(`$${total.toFixed(2)} USD`, totalsBoxX + totalsBoxWidth - 5, currentY + 16, { align: 'right' });

  // Multi-Currency Bolívares Line
  if (showVES && totalVES) {
    const calcRate = exchangeRateVES || totalVES / total;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Equivalente VES:', totalsBoxX + 5, currentY + 22.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Bs. ${totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, totalsBoxX + totalsBoxWidth - 5, currentY + 22.5, { align: 'right' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Tasa Ref: ${calcRate.toFixed(2)} Bs/$`, totalsBoxX + totalsBoxWidth - 5, currentY + 26, { align: 'right' });
  }

  // ── 6. Signature and Verification Box ────────────────────────────────
  const bottomY = Math.max(currentY + 36, 230);

  // Reception signature line
  doc.setDrawColor(148, 163, 184);
  doc.line(margin + 10, bottomY + 18, margin + 85, bottomY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Firma y C.I. de quien recibe conforme', margin + 18, bottomY + 23);

  // Legal Notice Box
  const noticeY = bottomY + 28;
  doc.setFillColor(254, 242, 242); // Red 50
  doc.roundedRect(margin, noticeY, contentWidth, 18, 2, 2, 'F');
  doc.setDrawColor(254, 202, 202); // Red 200
  doc.roundedRect(margin, noticeY, contentWidth, 18, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(185, 28, 28); // Red 700
  doc.text('AVISO DE ENTREGA — DOCUMENTO DE CONTROL INTERNO', margin + 4, noticeY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(127, 29, 29); // Red 900
  const legalText =
    'La presente nota de entrega tiene carácter informativo y de respaldo físico de la mercancía despachada. ' +
    'No constituye documento fiscal ni factura tributaria. Por favor envíe su comprobante de pago vía WhatsApp para la validación de la orden.';
  doc.text(doc.splitTextToSize(legalText, contentWidth - 8), margin + 4, noticeY + 9);

  // ── 7. Clean Bottom Footer ────────────────────────────────────────────
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generado electrónicamente por ${storeName || 'StoreLink'} • ${date}`, pageWidth / 2, 288, { align: 'center' });

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

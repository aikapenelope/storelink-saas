import { jsPDF } from 'jspdf';

export interface OrderPDFData {
  storeName: string;
  orderNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  paymentMethod?: string;
  currency: string;
  total: number;
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

  const { storeName, orderNumber, date, customerName, customerPhone, customerAddress, paymentMethod, currency, total, items } = data;

  // Primary brand header
  doc.setFillColor(22, 163, 74); // Green #16a34a
  doc.rect(0, 0, 210, 28, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(storeName.toUpperCase(), 14, 18);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('NOTA DE ENTREGA / PEDIDO', 140, 18);

  // Order & Date Info Box
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`N° de Pedido: #${orderNumber}`, 14, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha: ${date}`, 14, 44);

  // Customer Information Card
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 50, 182, 32, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 50, 182, 32, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('DATOS DEL CLIENTE', 18, 57);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`Cliente: ${customerName}`, 18, 64);
  doc.text(`Teléfono: ${customerPhone}`, 18, 70);
  doc.text(`Dirección: ${customerAddress || 'No especificada'}`, 18, 76);
  doc.text(`Pago: ${paymentMethod || 'No especificado'}`, 110, 64);

  // Products Table Header
  let y = 92;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text('SKU', 18, y + 5.5);
  doc.text('DESCRIPCIÓN', 45, y + 5.5);
  doc.text('CANT.', 130, y + 5.5);
  doc.text('PRECIO', 150, y + 5.5);
  doc.text('TOTAL', 175, y + 5.5);

  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  items.forEach((item) => {
    const itemTotal = (item.quantity * item.price).toFixed(2);
    doc.text(item.sku || 'N/A', 18, y + 4);
    doc.text(item.title.substring(0, 40), 45, y + 4);
    doc.text(String(item.quantity), 134, y + 4);
    doc.text(`$${item.price.toFixed(2)}`, 150, y + 4);
    doc.text(`$${itemTotal}`, 175, y + 4);

    doc.setDrawColor(241, 245, 249);
    doc.line(14, y + 7, 196, y + 7);
    y += 9;
  });

  // Totals Box
  y += 4;
  doc.setFillColor(248, 250, 252);
  doc.rect(125, y, 71, 20, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(125, y, 71, 20, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(22, 163, 74);
  doc.text(`TOTAL: $${total.toFixed(2)} ${currency}`, 130, y + 13);

  // Footer Note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Gracias por su compra. Documento generado electrónicamente por StoreLink PWA.', 14, 280);

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

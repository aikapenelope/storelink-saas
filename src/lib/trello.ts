export interface TrelloOrderPayload {
  apiKey: string;
  token: string;
  listId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  paymentMethod?: string;
  notes?: string;
  total: number;
  currency: string;
  items: Array<{
    sku: string;
    title: string;
    quantity: number;
    price: number;
  }>;
  pdfUrl?: string;
}

export async function createTrelloOrderCard(payload: TrelloOrderPayload): Promise<{ success: boolean; cardId?: string; error?: string }> {
  try {
    const { apiKey, token, listId, orderNumber, customerName, customerPhone, customerAddress, paymentMethod, notes, total, currency, items, pdfUrl } = payload;

    if (!apiKey || !token || !listId) {
      console.warn('Trello configuration missing for tenant');
      return { success: false, error: 'Credenciales de Trello no configuradas' };
    }

    const itemsSummary = items
      .map((item) => `- **[${item.sku || 'N/A'}]** ${item.quantity}x ${item.title} ($${item.price.toFixed(2)} c/u) = **$${(item.quantity * item.price).toFixed(2)}**`)
      .join('\n');

    const cardDescription = `
### 👤 DATOS DEL CLIENTE
* **Nombre:** ${customerName}
* **Teléfono:** [${customerPhone}](https://wa.me/${customerPhone.replace(/\D/g, '')})
* **Dirección de Entrega:** ${customerAddress || 'Retiro en local / No especificada'}
* **Método de Pago:** ${paymentMethod || 'No especificado'}
${notes ? `* **Notas:** ${notes}` : ''}

---

### 📦 PRODUCTOS DEL PEDIDO
${itemsSummary}

---

### 💰 TOTAL: **${total.toFixed(2)} ${currency}**
${pdfUrl ? `\n📄 **[Descargar Nota de Entrega en PDF](${pdfUrl})**` : ''}

_Creado automáticamente desde StoreLink PWA_
    `.trim();

    const cardTitle = `🛍️ Pedido #${orderNumber} - ${customerName} (${total.toFixed(2)} ${currency})`;

    const params = new URLSearchParams({
      key: apiKey,
      token: token,
      idList: listId,
      name: cardTitle,
      desc: cardDescription,
      pos: 'top',
    });

    const response = await fetch(`https://api.trello.com/1/cards?${params.toString()}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error creating Trello card:', errorText);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    return { success: true, cardId: data.id };
  } catch (err: any) {
    console.error('Trello API exception:', err);
    return { success: false, error: err.message };
  }
}

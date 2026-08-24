export interface TrelloOrderPayload {
  apiKey?: string;
  token?: string;
  listId?: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  paymentMethod?: string;
  notes?: string;
  total: number;
  totalVES?: number;
  exchangeRateVES?: number;
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
    const {
      apiKey,
      token,
      listId,
      orderNumber,
      customerName,
      customerPhone,
      customerAddress,
      paymentMethod,
      notes,
      total,
      totalVES,
      exchangeRateVES,
      currency,
      items,
      pdfUrl,
    } = payload;

    // 🔒 Audit Fix #2.5: Never relay client personal data to undocumented third-party endpoints
    // or use hardcoded board IDs. Only create cards if this specific merchant explicitly configured Trello.
    if (!apiKey || !token || !listId) {
      return { success: false, error: 'Credenciales de Trello no configuradas para este comercio' };
    }

    const itemsSummary = items
      .map((item) => `- **[${item.sku || 'N/A'}]** ${item.quantity}x ${item.title} ($${item.price.toFixed(2)} c/u) = **$${(item.quantity * item.price).toFixed(2)}**`)
      .join('\n');

    const vesText = totalVES
      ? `\n* **Equivalente VES:** Bs. ${totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })} (Tasa: ${exchangeRateVES?.toFixed(2) || 'N/A'} Bs/$)`
      : '';

    const cardDescription = `
### 👤 DATOS DEL CLIENTE
* **Cliente:** ${customerName}
* **WhatsApp:** [${customerPhone}](https://wa.me/${customerPhone.replace(/\D/g, '')})
* **Modalidad / Dirección:** ${customerAddress || 'Retiro en tienda (Pickup)'}
* **Método de Pago:** ${paymentMethod || 'No especificado'}
${notes ? `* **Observación / Nota:** ${notes}` : ''}

---

### 📦 PRODUCTOS DEL PEDIDO
${itemsSummary}

---

### 💰 TOTAL A PAGAR: **$${total.toFixed(2)} ${currency}**${vesText}
${pdfUrl ? `\n📄 **[Descargar Nota de Entrega en PDF](${pdfUrl})**` : ''}

_Generado automáticamente desde StoreLink PWA_
    `.trim();

    const cardTitle = `🛍️ Pedido #${orderNumber} — ${customerName} ($${total.toFixed(2)} ${currency})`;

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

    const data = (await response.json()) as { id?: string };
    return { success: true, cardId: data.id };
  } catch (err) {
    console.error('Trello API exception:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

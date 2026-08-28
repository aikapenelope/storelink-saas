export interface TrelloCredentialSource {
  apiKey?: string | null;
  token?: string | null;
}

/**
 * Resuelve qué par de credenciales de Trello usar para un pedido: BYOK del
 * tenant (mismo patrón que resend-tenant-adapter.ts para Resend) si trae
 * AMBOS `apiKey` y `token` propios, o el par completo de la cuenta maestra
 * global (Vercel) en caso contrario.
 *
 * "Ambos o ninguno" es intencional: un BYOK parcial (solo uno de los dos
 * campos) se descarta por completo en vez de mezclar una credencial del
 * tenant con la otra de la cuenta maestra — evita un estado híbrido que
 * Trello rechazaría de todas formas con un 401, pero sin la claridad de
 * saber si el fallback fue total.
 */
export function resolveTrelloCredentials(
  tenantConfig: TrelloCredentialSource | null | undefined,
  master: { apiKey?: string | null; token?: string | null }
): { apiKey: string; token: string } {
  const hasByokPair = Boolean(tenantConfig?.apiKey && tenantConfig?.token);
  return {
    apiKey: (hasByokPair ? tenantConfig?.apiKey : master.apiKey) || '',
    token: (hasByokPair ? tenantConfig?.token : master.token) || '',
  };
}

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
      // R3 (plan v2): timeout duro — sin él, un cuelgue de Trello retiene el
      // job hasta el timeout de la plataforma. Los reintentos ya los da la
      // Jobs Queue (3 attempts/backoff 30s).
      signal: AbortSignal.timeout(10000),
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

import type { TaskConfig, WorkflowConfig } from 'payload';
import { createTrelloOrderCard } from '@/lib/trello';
import { generateDeliveryNotePDF } from '@/lib/pdf';
import { orderPdfToken } from '@/lib/order-token';
import { buildOrderConfirmationEmailHtml } from '@/lib/order-email';
import { FALLBACK_EXCHANGE_RATE_VES } from '@/lib/exchange-rate';
import { Resend } from 'resend';

/**
 * Jobs Queue oficial de Payload 3 (https://payloadcms.com/docs/jobs-queue/overview):
 * el checkout ya NO crea la tarjeta de Trello ni envía el email dentro del
 * request. Encola el workflow `order-created` y el cron de Vercel ejecuta
 * /api/payload-jobs/run. Cada tarea tiene reintentos con backoff (APIs
 * externas → 3 intentos), y si una falla, el workflow reanuda desde el punto
 * de fallo sin repetir tareas ya completadas.
 */

const trelloDispatchOrder: TaskConfig = {
  slug: 'trelloDispatchOrder',
  label: 'Crear tarjeta del pedido en Trello',
  retries: { attempts: 3, backoff: { type: 'fixed', delay: 30000 } },
  inputSchema: [{ name: 'orderId', type: 'number', required: true }],
  outputSchema: [
    { name: 'skipped', type: 'checkbox' },
    { name: 'cardId', type: 'text' },
  ],
  handler: async ({ input, req }) => {
    const { payload } = req;
    const { orderId } = (input ?? {}) as { orderId: number };

    const order = (await payload.findByID({
      collection: 'orders',
      id: orderId,
      overrideAccess: true,
      req,
    })) as any;

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const tenantId = typeof order.tenant === 'object' ? order.tenant?.id : order.tenant;
    const tenantDoc = tenantId
      ? ((await payload.findByID({
          collection: 'tenants',
          id: tenantId as any,
          overrideAccess: true,
          req,
        }).catch(() => null)) as any)
      : null;

    // Modelo de operación: credencial MASTER global (Vercel) + listId por
    // tenant. Sin listId propio NO se despacha (nunca a tableros ajenos).
    const isTrelloEnabled = tenantDoc?.trelloConfig?.enabled !== false;
    const apiKey = process.env.TRELLO_API_KEY || '';
    const token = process.env.TRELLO_TOKEN || '';
    const listId = tenantDoc?.trelloConfig?.listId || '';

    if (!isTrelloEnabled || !apiKey || !token || !listId) {
      return { output: { skipped: true } };
    }

    const orderNumber = order.orderNumber || String(order.id);
    const pdfToken = orderPdfToken(orderNumber);
    const customer = order.customer || {};
    const items = Array.isArray(order.items)
      ? order.items.map((i: any) => ({
          sku: i.sku || 'S/N',
          title: i.title,
          quantity: Number(i.quantity) || 1,
          price: Number(i.price) || 0,
        }))
      : [];
    const total = Number(order.totalAmount) || 0;
    const exchangeRateVES = Number(order.exchangeRateVES) || FALLBACK_EXCHANGE_RATE_VES;

    const trelloRes = await createTrelloOrderCard({
      apiKey,
      token,
      listId,
      orderNumber,
      customerName: customer.name || 'Cliente',
      customerPhone: customer.phone || '',
      customerAddress: customer.address || undefined,
      paymentMethod: customer.paymentMethod,
      notes: customer.notes,
      total,
      totalVES: total * exchangeRateVES,
      exchangeRateVES,
      currency: order.currency || 'USD',
      items,
      pdfUrl: `/api/orders/${orderNumber}/pdf?token=${pdfToken}`,
    });

    await payload.update({
      collection: 'orders',
      id: orderId,
      overrideAccess: true,
      req,
      data: {
        trelloCardUrl: trelloRes?.cardId ? `https://trello.com/c/${trelloRes.cardId}` : undefined,
      },
    });

    return { output: { skipped: false, cardId: trelloRes?.cardId } };
  },
};

const sendOrderConfirmationEmail: TaskConfig = {
  slug: 'sendOrderConfirmationEmail',
  label: 'Enviar correo de confirmación con Nota de Entrega PDF',
  retries: { attempts: 3, backoff: { type: 'fixed', delay: 30000 } },
  inputSchema: [{ name: 'orderId', type: 'number', required: true }],
  outputSchema: [
    { name: 'skipped', type: 'checkbox' },
    { name: 'sent', type: 'checkbox' },
  ],
  handler: async ({ input, req }) => {
    const { payload } = req;
    const { orderId } = (input ?? {}) as { orderId: number };

    const order = (await payload.findByID({
      collection: 'orders',
      id: orderId,
      overrideAccess: true,
      req,
    })) as any;

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const tenantId = typeof order.tenant === 'object' ? order.tenant?.id : order.tenant;
    const tenantDoc = tenantId
      ? ((await payload.findByID({
          collection: 'tenants',
          id: tenantId as any,
          overrideAccess: true,
          req,
        }).catch(() => null)) as any)
      : null;

    const resendKey = tenantDoc?.emailConfig?.resendApiKey || process.env.RESEND_API_KEY || '';
    const fromEmail =
      tenantDoc?.emailConfig?.fromEmail ||
      process.env.RESEND_FROM_EMAIL ||
      'pedidos@flow.martes.app';
    const customerEmail = order.customer?.email;

    // Sin clave Resend configurada o sin correo del cliente → se omite
    if (!resendKey || !customerEmail) {
      return { output: { skipped: true } };
    }

    const orderNumber = order.orderNumber || String(order.id);
    const storeName = tenantDoc?.name || 'Flow Store';
    const total = Number(order.totalAmount) || 0;
    const exchangeRateVES = Number(order.exchangeRateVES) || FALLBACK_EXCHANGE_RATE_VES;
    const totalVES = total * exchangeRateVES;
    const items = Array.isArray(order.items)
      ? order.items.map((i: any) => ({
          sku: i.sku || 'N/A',
          title: i.title,
          quantity: Number(i.quantity) || 1,
          price: Number(i.price) || 0,
        }))
      : [];

    const emailSubject =
      tenantDoc?.emailConfig?.emailSubject ||
      `✨ ¡Hola, ${order.customer?.name || 'cliente'}! Tu pedido #${orderNumber} en ${storeName} está registrado`;

    const emailHtml = buildOrderConfirmationEmailHtml({
      storeName,
      customerName: order.customer?.name || 'Cliente',
      orderNumber,
      deliveryType: order.deliveryType || 'delivery',
      paymentLabel: order.paymentDetails?.methodKey || order.customer?.paymentMethod || 'PAGO ELECTRÓNICO',
      notes: order.customer?.notes,
      items,
      total,
      totalVES,
      exchangeRateVES,
      showVES: true,
    });

    // PDF de la Nota de Entrega (mismo generador del endpoint público)
    let pdfBase64: string | undefined = undefined;
    try {
      const dateStr = order.createdAt
        ? new Date(order.createdAt).toLocaleDateString('es-VE', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })
        : new Date().toLocaleDateString('es-VE');

      const pdfBytes = generateDeliveryNotePDF({
        storeName,
        orderNumber,
        date: dateStr,
        customerName: order.customer?.name || 'Cliente',
        customerPhone: order.customer?.phone || '',
        customerAddress: order.customer?.address || undefined,
        paymentMethod: order.customer?.paymentMethod || undefined,
        notes: order.customer?.notes || undefined,
        currency: order.currency || 'USD',
        total,
        totalVES,
        exchangeRateVES,
        showVES: true,
        items,
      });
      pdfBase64 = Buffer.from(pdfBytes).toString('base64');
    } catch (pdfErr) {
      console.warn('PDF generation warning (job):', pdfErr);
    }

    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: fromEmail,
      to: customerEmail,
      subject: emailSubject,
      html: emailHtml,
      attachments: pdfBase64
        ? [
            {
              filename: `Nota-Entrega-${orderNumber}.pdf`,
              content: pdfBase64,
            },
          ]
        : undefined,
    });

    return { output: { skipped: false, sent: true } };
  },
};

const orderCreatedWorkflow: WorkflowConfig<'order-created'> = {
  slug: 'order-created',
  label: 'Despacho de pedido (Trello + email)',
  inputSchema: [{ name: 'orderId', type: 'number', required: true }],
  handler: async ({ job, tasks }) => {
    const orderId = job.input.orderId as number;
    await tasks.trelloDispatchOrder('dispatch-trello', { input: { orderId } });
    await tasks.sendOrderConfirmationEmail('send-email', { input: { orderId } });
  },
};

export const orderJobs = {
  tasks: [trelloDispatchOrder, sendOrderConfirmationEmail],
  workflows: [orderCreatedWorkflow],
};
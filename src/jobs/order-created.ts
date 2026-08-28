import type { TaskConfig, WorkflowConfig } from 'payload';
import { createTrelloOrderCard } from '@/lib/trello';
import { getDeliveryNoteUrl } from '@/lib/delivery-note';
import { buildOrderConfirmationEmailHtml } from '@/lib/order-email';
import type { Order, Tenant } from '@/payload-types';

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
    })) as Order | null;

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Idempotencia: si la tarjeta ya se creó (p.ej. retry tras fallo de
    // update), no se duplica en Trello.
    if (order.trelloCardUrl && order.trelloCardUrl !== '__pending__') {
      const cardId = order.trelloCardUrl.split('/c/')[1] ?? undefined;
      return { output: { skipped: true, cardId } };
    }

    const tenantId = typeof order.tenant === 'object' ? order.tenant?.id : order.tenant;
    const tenantDoc = tenantId
      ? ((await payload.findByID({
          collection: 'tenants',
          id: tenantId,
          overrideAccess: true,
          req,
        }).catch(() => null)) as Tenant | null)
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

    // Sentinel lock: marca estado intermedio para evitar carreras si hay reintentos inmediatos.
    // Sprint 3: context.skipInventoryHook evita que el hook de inventario corra
    // en estas actualizaciones parciales (trelloCardUrl no cambia status de pedido).
    await payload.update({
      collection: 'orders',
      id: orderId,
      overrideAccess: true,
      req,
      context: { skipInventoryHook: true },
      data: {
        trelloCardUrl: '__pending__',
      },
    });

    const orderNumber = order.orderNumber || String(order.id);
    // URL firmada (R2) de la nota, válida 30 días desde el despacho
    const pdfUrl = await getDeliveryNoteUrl(orderNumber);
    const customer = order.customer;
    const items = Array.isArray(order.items)
      ? order.items.map((i) => ({
          sku: i.sku || 'S/N',
          title: i.title,
          quantity: Number(i.quantity) || 1,
          price: Number(i.price) || 0,
        }))
      : [];
    const total = Number(order.totalAmount) || 0;
    // Tasa VES del snapshot del pedido (manual del tenant al momento de comprar)
    const exchangeRateVES = Number(order.exchangeRateVES) || 0;

    const trelloRes = await createTrelloOrderCard({
      apiKey,
      token,
      listId,
      orderNumber,
      customerName: customer?.name || 'Cliente',
      customerPhone: customer?.phone || '',
      customerAddress: customer?.address || undefined,
      paymentMethod: customer?.paymentMethod ?? undefined,
      notes: customer?.notes ?? undefined,
      total,
      totalVES: total * exchangeRateVES,
      exchangeRateVES,
      currency: order.currency || 'USD',
      items,
      pdfUrl: pdfUrl ?? undefined,
    });

    // Un fallo de Trello debe LANZAR: los reintentos configurados (attempts:
    // 3, backoff 30s) solo corren si el handler lanza (docs/jobs-queue/
    // tasks.mdx — "throw errors directly for task failures"); retornar output
    // normal marca la tarea como exitosa y el despacho se pierde en silencio.
    if (!trelloRes.success) {
      throw new Error(`Trello dispatch failed: ${trelloRes.error ?? 'sin detalle'}`);
    }

    await payload.update({
      collection: 'orders',
      id: orderId,
      overrideAccess: true,
      req,
      context: { skipInventoryHook: true },
      data: {
        trelloCardUrl: trelloRes.cardId ? `https://trello.com/c/${trelloRes.cardId}` : undefined,
      },
    });

    return { output: { skipped: false, cardId: trelloRes.cardId ?? undefined } };
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
    })) as Order | null;

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Idempotencia: si el correo ya fue enviado exitosamente al cliente, no duplicar en reintentos
    if (order.emailConfirmationSent) {
      return { output: { skipped: true, sent: false } };
    }

    const tenantId = typeof order.tenant === 'object' ? order.tenant?.id : order.tenant;
    const tenantDoc = tenantId
      ? ((await payload.findByID({
          collection: 'tenants',
          id: tenantId,
          overrideAccess: true,
          req,
        }).catch(() => null)) as Tenant | null)
      : null;

    // Email oficial de Payload (adapter resend único con dominio autenticado):
    // El remitente se identifica con el NOMBRE de la tienda y la dirección verificada.
    // El replyTo va al correo de notificación del comercio.
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'pedidos@flow.martes.app';
    const customerEmail = order.customer?.email;

    if (!customerEmail) {
      return { output: { skipped: true } };
    }

    const orderNumber = order.orderNumber || String(order.id);
    const storeName = tenantDoc?.name || 'Flow Store';
    const fromDisplay = `${storeName} <${fromAddress}>`;
    const replyTo = tenantDoc?.emailConfig?.notificationEmail || tenantDoc?.emailConfig?.fromEmail || fromAddress;
    const total = Number(order.totalAmount) || 0;
    // Tasa VES del snapshot del pedido (manual del tenant); sin ella no se muestra Bs
    const exchangeRateVES = Number(order.exchangeRateVES) || 0;
    const showVES = exchangeRateVES > 0;
    const totalVES = total * exchangeRateVES;
    const items = Array.isArray(order.items)
      ? order.items.map((i) => ({
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
      notes: order.customer?.notes ?? undefined,
      items,
      total,
      totalVES,
      exchangeRateVES,
      showVES,
    });

    // La Nota de Entrega ya está en R2 (subida en el checkout); el email la
    // adjunta DESDE la URL (Resend la descarga) — sin regenerar el PDF.
    const emailPdfUrl = await getDeliveryNoteUrl(orderNumber);

    try {
      await payload.sendEmail({
        from: fromDisplay,
        replyTo,
        to: customerEmail,
        subject: emailSubject,
        html: emailHtml,
        attachments: emailPdfUrl
          ? [
              {
                filename: `Nota-Entrega-${orderNumber}.pdf`,
                path: emailPdfUrl,
              },
            ]
          : undefined,
      });

      // Actualizar flag de idempotencia en la orden tras envío exitoso.
      // Sprint 3: skipInventoryHook — emailConfirmationSent no afecta stock.
      await payload.update({
        collection: 'orders',
        id: orderId,
        overrideAccess: true,
        req,
        context: { skipInventoryHook: true },
        data: {
          emailConfirmationSent: true,
        },
      });
    } catch (emailErr) {
      console.error(`Error enviando correo de confirmación para pedido #${orderNumber}:`, emailErr);
      throw new Error(`Email dispatch failed: ${emailErr instanceof Error ? emailErr.message : 'Error desconocido'}`);
    }

    // Notificación opcional al comercio para alertar sobre nueva orden recibida
    if (tenantDoc?.emailConfig?.notificationEmail) {
      await payload.sendEmail({
        from: `Flow · ${storeName} <${fromAddress}>`,
        replyTo: customerEmail,
        to: tenantDoc.emailConfig.notificationEmail,
        subject: `🔔 [Nuevo Pedido #${orderNumber}] ${order.customer?.name || 'Cliente'} - $${total.toFixed(2)} USD`,
        html: emailHtml,
        attachments: emailPdfUrl
          ? [
              {
                filename: `Nota-Entrega-${orderNumber}.pdf`,
                path: emailPdfUrl,
              },
            ]
          : undefined,
      }).catch((notifErr) => {
        console.warn('Error enviando correo de alerta al comercio:', notifErr);
      });
    }

    return { output: { skipped: false, sent: true } };
  },
};

const orderCreatedWorkflow: WorkflowConfig<'order-created'> = {
  slug: 'order-created',
  label: 'Despacho de pedido (Trello + email)',
  inputSchema: [{ name: 'orderId', type: 'number', required: true }],
  handler: async ({ job, tasks }) => {
    const orderId = job.input.orderId as number;
    // Email primero, Trello después: si Trello falla de forma persistente,
    // el email ya se envió (tareas independientes, como antes con try/catch).
    await tasks.sendOrderConfirmationEmail('send-email', { input: { orderId } });
    await tasks.trelloDispatchOrder('dispatch-trello', { input: { orderId } });
  },
};

export const orderJobs = {
  tasks: [trelloDispatchOrder, sendOrderConfirmationEmail],
  workflows: [orderCreatedWorkflow],
};
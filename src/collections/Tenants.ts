import type { CollectionConfig } from 'payload';

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'theme', 'whatsappPhone', 'createdAt'],
  },
  access: {
    read: () => true, // Public read so storefronts can read store info
    create: ({ req: { user } }) => (user as any)?.role === 'super-admin',
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => (user as any)?.role === 'super-admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Nombre del Comercio',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: 'Identificador / Subdominio (ej: don-luigi)',
      admin: {
        description: 'Se usará para la URL: tudominio.com/[slug] o [slug].tudominio.com',
      },
    },
    {
      name: 'theme',
      type: 'select',
      label: 'Plan y Diseño del Catálogo (Theme UI)',
      defaultValue: 'basic-banner',
      options: [
        { label: '🏷️ Plan Básico (Banner Header & Catálogo Rápido)', value: 'basic-banner' },
        { label: '🍔 Comida & Restaurantes (Delivery & Menú - Premium)', value: 'food-delivery' },
        { label: '👗 Tienda de Ropa & Moda (Boutique Lookbook - Premium)', value: 'fashion-boutique' },
        { label: '🏍️ Repuestos de Moto & Accesorios (Moto Pro - Premium)', value: 'moto-parts' },
        { label: '🔧 Ferretería & Herramientas (Ferretería Industrial - Premium)', value: 'hardware-store' },
      ],
      admin: {
        description: 'Elige si la tienda usa la plantilla del Plan Básico o una de las plantillas Premium especializadas.',
      },
    },
    {
      name: 'whatsappPhone',
      type: 'text',
      required: true,
      label: 'Teléfono de WhatsApp para Pedidos',
      admin: {
        description: 'Incluir código de país sin el signo + (ej: 34600111222 o 584121234567)',
      },
    },
    {
      name: 'emailConfig',
      type: 'group',
      label: 'Notificaciones por Correo (Multi-Tenant Resend)',
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: true,
          label: 'Activar envío de comprobantes y PDF por correo al cliente',
        },
        {
          name: 'resendApiKey',
          type: 'text',
          label: 'API Key de Resend Propia del Comercio (Opcional - BYOK)',
          admin: {
            description: 'Si el comercio coloca su propia clave de Resend, usará su cuenta y su cuota individual. Si se deja vacío, usa la clave global del sistema.',
          },
        },
        {
          name: 'fromEmail',
          type: 'text',
          label: 'Correo Remitente Personalizado (ej: pedidos@mitienda.com)',
          admin: {
            description: 'Debe estar verificado en la cuenta de Resend utilizada.',
          },
        },
        {
          name: 'notificationEmail',
          type: 'email',
          label: 'Correo del Comercio para Recibir Alerta de Nuevos Pedidos',
          admin: {
            description: 'Recibirá una copia de cada orden generada con el PDF de nota de entrega adjunto.',
          },
        },
        {
          name: 'emailSubject',
          type: 'text',
          label: 'Asunto Personalizado del Correo',
          defaultValue: '🛍️ Confirmación y Comprobante de tu Pedido',
        },
      ],
    },
    {
      name: 'trelloConfig',
      type: 'group',
      label: 'Integración con Trello',
      fields: [
        {
          name: 'apiKey',
          type: 'text',
          label: 'Trello API Key',
        },
        {
          name: 'token',
          type: 'text',
          label: 'Trello Member Token',
        },
        {
          name: 'listId',
          type: 'text',
          label: 'ID de la Lista de Trello (Donde caen los pedidos)',
        },
      ],
    },
    {
      name: 'branding',
      type: 'group',
      label: 'Personalización de Marca & Moneda',
      fields: [
        {
          name: 'logo',
          type: 'upload',
          relationTo: 'media',
          label: 'Logo de la Tienda',
        },
        {
          name: 'currency',
          type: 'select',
          defaultValue: 'USD',
          options: [
            { label: 'Dólar Estadounidense ($ USD)', value: 'USD' },
            { label: 'Euro (€ EUR)', value: 'EUR' },
            { label: 'Peso Mexicano ($ MXN)', value: 'MXN' },
            { label: 'Peso Colombiano ($ COP)', value: 'COP' },
          ],
        },
        {
          name: 'showVES',
          type: 'checkbox',
          defaultValue: true,
          label: 'Habilitar cálculo multimoneda en Bolívares (Bs. VES)',
        },
        {
          name: 'exchangeRateVES',
          type: 'number',
          label: 'Tasa de Cambio Manual en Bolívares (VES por cada 1 USD)',
          admin: {
            condition: (data) => Boolean(data?.branding?.showVES),
            description: 'Si se deja vacío o en 0, el sistema toma automáticamente la tasa en tiempo real de Binance P2P.',
          },
        },
        {
          name: 'primaryColor',
          type: 'text',
          defaultValue: '#1e293b',
          label: 'Color Primario (Hexadecimal)',
        },
        {
          name: 'welcomeMessage',
          type: 'textarea',
          label: 'Mensaje de Bienvenida en la Tienda',
          defaultValue: '¡Bienvenido a nuestro catálogo! Haz tu pedido y lo recibirás directo por WhatsApp.',
        },
      ],
    },
  ],
};

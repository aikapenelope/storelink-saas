import type { CollectionConfig } from 'payload';
import { getUserRole } from '@/lib/utils';

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'theme', 'whatsappPhone', 'createdAt'],
    hidden: ({ user }) => getUserRole(user) !== 'super-admin',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => getUserRole(user) === 'super-admin',
    update: ({ req: { user } }) => getUserRole(user) === 'super-admin',
    delete: ({ req: { user } }) => getUserRole(user) === 'super-admin',
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
      label: 'Identificador / Ruta de la Tienda (ej: aura-modaaa)',
      admin: {
        description: 'La URL pública de la tienda se creará de inmediato en: https://flow.martes.app/[slug]',
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
      access: {
        read: ({ req: { user } }) => Boolean(user),
        update: ({ req: { user } }) => Boolean(user),
      },
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
      label: 'Espacio de Trabajo Trello (Kanban)',
      access: {
        read: ({ req: { user } }) => Boolean(user),
        update: ({ req: { user } }) => Boolean(user),
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Activar recepción de pedidos en Trello para esta tienda',
          defaultValue: true,
        },
        {
          name: 'workspaceName',
          type: 'text',
          label: 'Nombre del Workspace de Trello',
          admin: {
            description: 'Ej: Aura Moda (Espacio de trabajo dedicado para esta tienda)',
          },
        },
        {
          name: 'boardName',
          type: 'text',
          label: 'Nombre del Tablero de Pedidos',
          admin: {
            description: 'Ej: Pedidos Aura Moda',
          },
        },
        {
          name: 'boardUrl',
          type: 'text',
          label: 'Enlace Web al Tablero de Trello',
          admin: {
            description: 'URL directa para abrir el tablero desde el Dashboard o celular',
          },
        },
        {
          name: 'listId',
          type: 'text',
          label: 'ID de la Lista de Pendientes (Donde caen los pedidos)',
          admin: {
            description: 'ID de 24 caracteres alfanuméricos de la columna "Pendiente" del tablero en Trello',
          },
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
    {
      name: 'pickupConfig',
      type: 'group',
      label: 'Retiro en Tienda / Pickup',
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: true,
          label: 'Habilitar opción de Retiro en Tienda',
        },
        {
          name: 'locationAddress',
          type: 'textarea',
          label: 'Dirección Exacta de la Sede para Pickup',
        },
        {
          name: 'schedule',
          type: 'text',
          label: 'Horario de Atención (ej: Lun-Dom 11:30 AM - 10:00 PM)',
        },
        {
          name: 'estimatedTime',
          type: 'text',
          label: 'Tiempo Estimado de Preparación (ej: 20-30 min)',
        },
        {
          name: 'instructions',
          type: 'text',
          label: 'Indicaciones para Retirar (ej: Presentar número de orden en caja)',
        },
      ],
    },
    {
      name: 'paymentMethodsConfig',
      type: 'group',
      label: 'Cuentas Receptoras y Métodos de Pago del Comercio',
      fields: [
        {
          name: 'pagoMovil',
          type: 'group',
          label: '🇻🇪 Pago Móvil (Bolívares VES)',
          fields: [
            { name: 'enabled', type: 'checkbox', defaultValue: true, label: 'Aceptar Pago Móvil' },
            { name: 'bank', type: 'text', label: 'Banco Destino (ej: Banesco, Mercantil, BDV)' },
            { name: 'phone', type: 'text', label: 'Teléfono Receptor (ej: 04121234567)' },
            { name: 'idDoc', type: 'text', label: 'Cédula / RIF (ej: V-12345678 o J-123456789)' },
            { name: 'accountHolder', type: 'text', label: 'Titular de la Cuenta' },
          ],
        },
        {
          name: 'zelle',
          type: 'group',
          label: '🇺🇸 Zelle (USD)',
          fields: [
            { name: 'enabled', type: 'checkbox', defaultValue: false, label: 'Aceptar Zelle' },
            { name: 'email', type: 'email', label: 'Correo Registrado en Zelle' },
            { name: 'accountHolder', type: 'text', label: 'Nombre del Titular' },
          ],
        },
        {
          name: 'binance',
          type: 'group',
          label: '🟡 Binance Pay (USDT)',
          fields: [
            { name: 'enabled', type: 'checkbox', defaultValue: false, label: 'Aceptar Binance Pay' },
            { name: 'payId', type: 'text', label: 'Binance Pay ID (8-9 dígitos)' },
            { name: 'nickname', type: 'text', label: 'Nickname de Binance' },
          ],
        },
        {
          name: 'zinli',
          type: 'group',
          label: '🟣 Zinli (USD)',
          fields: [
            { name: 'enabled', type: 'checkbox', defaultValue: false, label: 'Aceptar Zinli' },
            { name: 'email', type: 'email', label: 'Correo de la Cuenta Zinli' },
            { name: 'accountHolder', type: 'text', label: 'Titular de la Cuenta' },
          ],
        },
        {
          name: 'banescoPanama',
          type: 'group',
          label: '🇵🇦 Banesco Panamá / Transferencia Internacional',
          fields: [
            { name: 'enabled', type: 'checkbox', defaultValue: false, label: 'Aceptar Banesco Panamá' },
            { name: 'accountNumber', type: 'text', label: 'Número de Cuenta' },
            { name: 'accountHolder', type: 'text', label: 'Titular de la Cuenta' },
            { name: 'accountType', type: 'text', label: 'Tipo de Cuenta (ej: Ahorros / Corriente)' },
          ],
        },
        {
          name: 'cash',
          type: 'group',
          label: '💵 Efectivo ($ USD / Bs.)',
          fields: [
            { name: 'enabled', type: 'checkbox', defaultValue: true, label: 'Aceptar Efectivo contra entrega / en tienda' },
            { name: 'instructions', type: 'text', label: 'Indicaciones (ej: Por favor indicar denominación para el cambio)' },
          ],
        },
        {
          name: 'pos',
          type: 'group',
          label: '💳 Punto de Venta / Tarjeta en Tienda',
          fields: [
            { name: 'enabled', type: 'checkbox', defaultValue: true, label: 'Aceptar Punto de Venta / Tarjeta' },
            { name: 'instructions', type: 'text', label: 'Indicaciones (ej: Débito nacional / Crédito)' },
          ],
        },
      ],
    },
    {
      name: 'deliveryConfig',
      type: 'group',
      label: 'Zonas y Tarifas de Delivery / Envío',
      fields: [
        {
          name: 'zones',
          type: 'array',
          label: 'Zonas de Cobertura y Tarifas',
          labels: {
            singular: 'Zona de Envío',
            plural: 'Zonas de Envío',
          },
          fields: [
            { name: 'name', type: 'text', required: true, label: 'Municipio / Sector (ej: Chacao, Baruta, El Hatillo)' },
            { name: 'priceDelivery', type: 'number', min: 0, defaultValue: 0, label: 'Tarifa de Delivery ($ USD)' },
            { name: 'estimatedTime', type: 'text', label: 'Tiempo Estimado de Entrega (ej: 35-50 min)' },
          ],
        },
      ],
    },
  ],
};

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
      label: 'Diseño del Catálogo (Theme UI)',
      defaultValue: 'food-delivery',
      options: [
        { label: '🍔 Comida & Restaurantes (Delivery & Menú)', value: 'food-delivery' },
        { label: '👗 Tienda de Ropa & Moda (Boutique Lookbook)', value: 'fashion-boutique' },
        { label: '🏍️ Repuestos de Moto & Accesorios (Moto Pro)', value: 'moto-parts' },
        { label: '🔧 Ferretería & Herramientas (Ferretería Industrial)', value: 'hardware-store' },
      ],
      admin: {
        description: 'Elige el modelo visual especializado para tu tipo de comercio.',
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
      label: 'Personalización de Marca',
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
          name: 'primaryColor',
          type: 'text',
          defaultValue: '#f97316',
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

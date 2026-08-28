import type { CollectionConfig, TextFieldSingleValidation } from 'payload';
import { getUserRole, getUserTenantIds, hasTenantAccess } from '@/lib/utils';

/**
 * F1 (auditoría BYOK 2026-08-29): resend-tenant-adapter.ts resuelve la clave
 * de Resend por `emailConfig.fromEmail`, NO por `tenant.id`. Sin esta
 * validación, dos tenants con el mismo fromEmail hacían que el adapter le
 * prestara silenciosamente la clave de Resend de un tenant a otro. La
 * migración 20260830_tenants_from_email_unique.ts es la garantía real a
 * nivel de BD (defensa en profundidad contra condiciones de carrera entre
 * dos guardados simultáneos); este validate solo da el error amigable en
 * el admin antes de llegar a esa restricción.
 */
const validateUniqueFromEmail: TextFieldSingleValidation = async (value, { req, id }) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return true;

  const conflict = await req.payload.find({
    collection: 'tenants',
    where: {
      and: [
        { 'emailConfig.fromEmail': { equals: trimmed } },
        ...(id ? [{ id: { not_equals: id } }] : []),
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  if (conflict.docs.length > 0) {
    const otherName = (conflict.docs[0] as { name?: string }).name || 'otro comercio';
    return `Este correo remitente ya está en uso por "${otherName}". Cada comercio debe usar un correo remitente distinto (resend-tenant-adapter.ts resuelve la clave BYOK por este campo).`;
  }
  return true;
};

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'theme', 'whatsappPhone', 'createdAt'],
    hidden: ({ user }) => getUserRole(user) !== 'super-admin',
  },
  access: {
    // Audit fix C2: los datos de tenants ya no son públicos vía REST API.
    // El storefront sigue funcionando porque consulta por la Local API del
    // servidor (que por diseño aplica overrideAccess=true por defecto,
    // según https://payloadcms.com/docs/local-api/overview#overrideaccess).
    // Cada comercio autenticado solo ve SU tenant (patrón oficial de
    // constraints de query: https://payloadcms.com/docs/access-control/collections).
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (getUserRole(user) === 'super-admin') return true;
      const ids = getUserTenantIds(user);
      if (ids.length === 0) return false;
      return { id: { in: ids } };
    },
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
      // Sprint 2: se mantiene type:'text' porque `slugField()` está marcado
      // @experimental en Payload 3.88 — no apto para producción con clientes reales.
      // Se añade index:true para que el schema de Payload declare explícitamente
      // el índice que ya existe en BD (el unique implica un índice; declararlo
      // evita discrepancias en el análisis de query plans y futuras migraciones).
      // Pendiente: migrar a slugField() cuando el API sea estable (>= Payload 4).
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
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
        { label: '🏢 B2B & Distribución Mayorista (Matriz de Pedidos Rápida)', value: 'b2b-matrix' },
        { label: '✨ Lookbook Editorial & Alta Gama (Elegancia)', value: 'editorial' },
        { label: '📱 Fluid Mobile (Experiencia Web Móvil Moderna)', value: 'fluid-pwa' },
        { label: '⚡ Minimal Dark Tech (Electrónica & Periféricos)', value: 'vercel-commerce' },
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
        read: ({ req: { user } }) => hasTenantAccess(user),
        update: ({ req: { user } }) => hasTenantAccess(user),
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
          // F5 (auditoría P0): write-only — la key BYOK se guarda pero NUNCA
          // se devuelve por REST/admin (quedaría en cachés/devtools). Los
          // flujos server-side (jobs con overrideAccess:true) sí la leen.
          access: {
            read: () => false,
          },
          label: 'API Key de Resend Propia del Comercio (Opcional - BYOK)',
          admin: {
            description: 'Se guarda oculta (write-only): pégala para usarla o pégala de nuevo para rotarla. Si el comercio coloca su propia clave de Resend, usará su cuenta y su cuota individual; si se deja vacío, usa la clave global del sistema.',
          },
        },
        {
          name: 'fromEmail',
          type: 'text',
          label: 'Correo Remitente Personalizado (ej: pedidos@mitienda.com)',
          index: true,
          admin: {
            description: 'Debe estar verificado en la cuenta de Resend utilizada. Debe ser único: ningún otro comercio puede usar el mismo correo remitente.',
          },
          validate: validateUniqueFromEmail,
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
        read: ({ req: { user } }) => hasTenantAccess(user),
        update: ({ req: { user } }) => hasTenantAccess(user),
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
        {
          // BYOK Trello (mismo patrón que emailConfig.resendApiKey): un
          // comercio avanzado puede traer su PROPIA cuenta de Trello para no
          // depender de la credencial maestra global (aislamiento operativo
          // — si la cuenta maestra se suspende o se compromete, este tenant
          // no se ve afectado). Write-only: nunca se devuelve por REST/admin.
          name: 'apiKey',
          type: 'text',
          access: {
            read: () => false,
          },
          label: 'API Key de Trello Propia del Comercio (Opcional - BYOK)',
          admin: {
            description: 'Se guarda oculta (write-only): pégala para usarla o pégala de nuevo para rotarla. Requiere también su Token propio (ambos o ninguno). Si se deja vacío, usa la cuenta maestra global del sistema.',
          },
        },
        {
          name: 'token',
          type: 'text',
          access: {
            read: () => false,
          },
          label: 'Token de Trello Propio del Comercio (Opcional - BYOK)',
          admin: {
            description: 'Se guarda oculto (write-only), igual que la API Key propia. Ambos campos deben venir de la misma cuenta de Trello del comercio.',
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
      // Audit fix C2 (defensa en profundidad): los datos bancarios de cada
      // comercio solo se leen/escriben con sesión activa, y un tenant-admin
      // solo puede leerlos/editarlos en SU tenant. La restricción por documento
      // ya la aplica el plugin multi-tenant; este field-level access evita que
      // un admin de otra tienda los vea si algún día Tenants.read se amplía.
      // Patrón oficial: https://payloadcms.com/docs/access-control/fields
      access: {
        read: ({ req: { user } }) => Boolean(user),
        create: ({ req: { user } }) => Boolean(user),
        update: ({ req: { user } }) => Boolean(user),
      },
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
      label: 'Configuración de Delivery / Envíos',
      fields: [
        {
          name: 'fixedPrice',
          type: 'number',
          min: 0,
          defaultValue: 0,
          label: 'Tarifa Fija de Delivery ($ USD)',
          admin: {
            description: 'Costo fijo de envío que se suma automáticamente al pedido cuando el cliente selecciona Delivery. Si se coloca 0, el delivery no tiene costo adicional.',
          },
        },
        {
          name: 'estimatedTime',
          type: 'text',
          label: 'Tiempo Estimado de Entrega (ej: 30-45 min)',
          admin: {
            description: 'Aparece en el checkout y en el mensaje de confirmación.',
          },
        },
        {
          name: 'zones',
          type: 'array',
          label: 'Zonas de Cobertura Informativas (Opcional)',
          labels: {
            singular: 'Zona de Cobertura',
            plural: 'Zonas de Cobertura',
          },
          fields: [
            { name: 'name', type: 'text', required: true, label: 'Municipio / Sector (ej: Chacao, Baruta, El Hatillo)' },
            { name: 'priceDelivery', type: 'number', min: 0, defaultValue: 0, label: 'Tarifa Específica de Zona (opcional, $ USD)' },
            { name: 'estimatedTime', type: 'text', label: 'Tiempo Estimado de Entrega (ej: 35-50 min)' },
          ],
        },
      ],
    },
  ],
};

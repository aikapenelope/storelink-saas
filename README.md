# 🚀 StoreLink SaaS • Multi-Tenant E-Commerce Platform

Plataforma SaaS multi-inquilino de catálogos y e-commerce orientada a PWA móvil, con panel de administración profesional por comercio, notas de entrega en PDF y despacho automático de órdenes a Trello y WhatsApp.

---

## 🌟 Características Principales

* 🏪 **Multi-Tenant Real:** Cada comerciante tiene su propia tienda PWA en la ruta `https://flow.martes.app/[slug]` (ej: `flow.martes.app/donluigi`).
* 🎨 **9 Plantillas de Tienda & Temas Oficiales:** Soporte nativo para 9 estéticas por nicho (`basic-banner`, `food-delivery`, `fashion-boutique`, `moto-parts`, `hardware-store`, `b2b-matrix`, `editorial`, `fluid-pwa`, `vercel-commerce`), seleccionables al crear o editar el comercio en Payload y explorables en `/templates`.
* 🛵 **Tarifa Fija de Delivery (Definición del Producto):** El costo de delivery es un **precio fijo** establecido por el comercio en la configuración de Payload (`deliveryConfig.fixedPrice`). Se muestra con transparencia en el catálogo, se suma al subtotal de productos en el carrito, se desglosa en el mensaje estructurado de WhatsApp y se refleja en la Nota de Entrega PDF.
* 📱 **PWA Mobile-First:** Experiencia tipo app nativa con píldoras de categorías, buscador en vivo, cajón inferior deslizante (`Vaul`), personalizador interactivo de variantes/modificadores y modal de producto.
* 💬 **Checkout Directo a WhatsApp:** Formatea y suma los SKUs, subtotales, tarifa de delivery fija, datos de entrega del comprador y abre el chat de WhatsApp con un solo clic.
* 📋 **Despacho Automático a Trello:** Cada pedido crea una tarjeta en tiempo real en el workspace/lista de su comercio (`POST https://api.trello.com/1/cards`), saliendo todos por la misma credencial maestra configurada en Vercel.
* 📄 **Notas de Entrega en PDF:** Generación instantánea de notas de entrega en PDF multi-página con logo del comercio, datos del cliente, desglose de ítems, tarifa de delivery y totales USD/VES. Almacenamiento seguro en Cloudflare R2 con URLs firmadas.
* 📧 **Adapter de Correo Centralizado:** Integración con Resend a través del adaptador oficial `@payloadcms/email-resend`, centralizado a nivel de plataforma con remitente personalizado por comercio (`fromName = storeName`).
* 🛡️ **Panel de Administración (Payload CMS 3.x):** Gestión de inventario, stock, precios, subida de fotos a Cloudflare R2, y control de usuarios super-admin / tenant-admin.
* ☁️ **Infraestructura a Coste $0:**
  * **Vercel:** Hosting y Serverless Functions.
  * **Supabase:** Base de datos PostgreSQL (Transaction Pooler 6543).
  * **Cloudflare R2:** Almacenamiento de imágenes (10 GB gratis sin costes de transferencia).

> ℹ️ **Nota:** La sincronización automática del catálogo con Meta WhatsApp Business fue retirada del alcance del producto. Los pedidos entran exclusivamente por el checkout de la tienda PWA.

---

## 🛵 Configuración del Delivery (Regla de Negocio)

El delivery en Flow funciona bajo el esquema de **costo fijo por comercio**:
1. En el panel de administración de Payload (`Tenants` -> `Configuración de Delivery`), el comercio define el campo **Tarifa Fija de Delivery en USD** (`fixedPrice`, ej: `$3.00`) y opcionalmente el **Tiempo Estimado de Entrega** (`estimatedTime`, ej: `30-45 min`).
2. En el storefront, cuando el cliente selecciona la modalidad **Delivery**, el carrito muestra la tarifa y la suma automáticamente al total a pagar en USD y en Bolívares (VES).
3. En el checkout, la Server Action valida la tarifa fija del comercio en base de datos para garantizar la integridad financiera de la orden.
4. El mensaje de WhatsApp y el PDF generado incluyen la línea separada: `🛵 Tarifa Delivery: $X.XX USD`.

---

## 🔐 Seguridad (Auditoría Ago 2026)

* Datos bancarios de los comercios (`paymentMethodsConfig`) solo visibles con sesión activa; nunca expuestos por la API pública.
* El array `tenants` de cada usuario solo puede ser modificado por un super-admin (opción oficial `tenantsArrayField.arrayFieldAccess` del plugin multi-tenant).
* Los PDFs de pedidos exigen sesión de admin o token opaco por pedido (`?token=...`, entregado en el checkout).
* Descuento de inventario atómico dentro de la transacción oficial de Payload (sin sobreventa por pedidos simultáneos).
* Sanitización de HTML en correos y de texto plano en mensajes de WhatsApp.

---

## 🗺️ Roadmap V2

Las consideraciones de escala para operar 100–200 tiendas concurrentes están documentadas en [`ROADMAP_V2.md`](./ROADMAP_V2.md): caché/ISR del storefront, imports batch, agregaciones SQL para analíticas, rate-limiting del checkout, entre otros.

---

## 🛠️ Estructura del Proyecto

```
storelink-saas/
├── src/
│   ├── app/
│   │   ├── (payload)/               # Rutas del Admin Panel y API de Payload
│   │   ├── [tenant]/page.tsx        # Catálogo PWA por comercio (flow.martes.app/[slug])
│   │   ├── actions/checkout.ts      # Server Action (Trello + PDF + WhatsApp + CRM)
│   │   └── api/
│   │       ├── [tenant]/            # sync-sheets, import-csv, exchange-rate
│   │       └── orders/[id]/pdf/     # Nota de entrega (auth o token)
│   ├── collections/                 # Esquemas de Payload CMS
│   │   ├── Tenants.ts               # Comercios, pagos, Trello (listId), pickup
│   │   ├── Users.ts                 # Super Admins y Administradores de Tienda
│   │   ├── Products.ts              # Catálogo, stock y variantes
│   │   ├── Orders.ts                # Pedidos + hook de inventario transaccional
│   │   └── Customers.ts             # CRM ligero por comercio
│   ├── components/
│   │   ├── cart-drawer.tsx          # Cajón de carrito y formulario de checkout
│   │   └── themes/                  # Plantillas visuales por nicho
│   ├── lib/
│   │   ├── trello.ts                # Integración con Trello API
│   │   ├── pdf.ts                   # Generador de Nota de Entrega en PDF (jsPDF)
│   │   ├── exchange-rate.ts         # Tasas BCV / Paralelo / Binance P2P
│   │   └── order-token.ts           # Token opaco para PDFs públicos
│   └── payload.config.ts            # Configuración de Payload CMS (multi-tenant)
├── docs/GUIA_GESTION_FLOW.md        # Manual operativo paso a paso
├── ROADMAP_V2.md                    # Escala 100–200 tiendas
└── package.json
```

---

## ⚙️ Variables de Entorno

Ver `.env.example`. Las credenciales de Trello (`TRELLO_API_KEY`, `TRELLO_TOKEN`) son **globales** (cuenta maestra en Vercel); cada comercio solo configura su `listId` destino desde el panel.

## 🚦 Comandos

```bash
pnpm install
pnpm dev        # desarrollo
pnpm build      # producción
pnpm migrate    # migraciones PostgreSQL
```

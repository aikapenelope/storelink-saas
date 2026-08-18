# 🚀 StoreLink SaaS • Multi-Tenant E-Commerce Platform

Plataforma SaaS multi-inquilino de catálogos y e-commerce orientada a PWA móvil, con panel de administración profesional por comercio, sincronización con el catálogo de WhatsApp de Meta, generación de notas de entrega en PDF y despacho automático de órdenes a Trello y WhatsApp.

---

## 🌟 Características Principales

* 🏪 **Multi-Tenant Real:** Cada comerciante tiene su propia tienda PWA (`/[tenant]` o subdominios `tienda.tudominio.com`).
* 📱 **PWA Mobile-First:** Experiencia tipo app nativa con píldoras de categorías, buscador en vivo, cajón inferior deslizante (`Vaul`) y modal de producto.
* 💬 **Checkout Directo a WhatsApp:** Formatea y suma los SKUs, subtotales, datos de entrega del comprador y abre el chat de WhatsApp con un solo clic.
* 📋 **Despacho Automático a Trello:** Crea tarjetas en tiempo real en el tablero y lista del comercio (`POST https://api.trello.com/1/cards`).
* 📄 **Notas de Entrega en PDF:** Generación instantánea de notas de entrega en PDF con logo del comercio, datos del cliente y desglose de ítems.
* 🔄 **Feed para Meta WhatsApp Catalog:** Endpoint `/api/[tenant]/feed.csv` para mantener sincronizado el catálogo nativo de WhatsApp Business automáticamente.
* 🛡️ **Panel de Administración (Payload CMS 3.0):** Gestión de inventario, stock, precios, subida de fotos por arrastrar y soltar, y control de usuarios.
* ☁️ **Infraestructura a Coste $0:**
  * **Vercel:** Hosting y Serverless Functions.
  * **Supabase:** Base de datos PostgreSQL (500 MB gratis).
  * **Cloudflare R2:** Almacenamiento de imágenes (10 GB gratis sin costes de transferencia).

---

## 🛠️ Estructura del Proyecto

```
storelink-saas/
├── src/
│   ├── app/
│   │   ├── (payload)/               # Rutas del Admin Panel y API de Payload
│   │   ├── [tenant]/page.tsx        # Catálogo PWA por comercio
│   │   ├── actions/checkout.ts      # Server Action (Trello + PDF + WhatsApp)
│   │   ├── api/[tenant]/feed.csv/   # Feed CSV para Meta WhatsApp Catalog
│   │   ├── globals.css              # Estilos globales y Tailwind CSS
│   │   ├── layout.tsx               # Layout raíz con configuración PWA
│   │   └── page.tsx                 # Landing page de la plataforma
│   ├── collections/                 # Esquemas de Payload CMS
│   │   ├── Tenants.ts               # Comercios y configuraciones de Trello/WhatsApp
│   │   ├── Users.ts                 # Super Admins y Administradores de Tienda
│   │   ├── Products.ts              # Catálogo de productos y SKUs
│   │   ├── Categories.ts            # Categorías de productos
│   │   └── Media.ts                 # Imágenes en Cloudflare R2
│   ├── components/
│   │   ├── cart-drawer.tsx          # Cajón de carrito y formulario de checkout
│   │   └── product-card.tsx         # Tarjeta de producto con modales interactivos
│   ├── lib/
│   │   ├── trello.ts                # Integración con Trello API
│   │   ├── pdf.ts                   # Generador de Nota de Entrega en PDF (jsPDF)
│   │   └── utils.ts                 # Utilidades y formateadores
│   └── payload.config.ts            # Configuración de Payload CMS 3.0
├── package.json
└── README.md
```

---

## ⚙️ Variables de Entorno (`.env.local`)

```env
PAYLOAD_SECRET=your_super_secret_payload_key_min_32_chars
DATABASE_URI=postgresql://postgres.xxx:password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require
POSTGRES_URL=postgresql://postgres.xxx:password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require

# Cloudflare R2 (Opcional - Almacenamiento de fotos)
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET=storelink-images
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
R2_REGION=auto

NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

---

## 🚀 Despliegue en Vercel y GitHub

1. Inicializar git y subir al repositorio:
   ```bash
   git init
   git add .
   git commit -m "feat: initial storelink saas multi-tenant"
   gh repo create storelink-saas --private --source=. --push
   ```
2. Conectar el repositorio en **Vercel**:
   * Importar el repositorio desde el dashboard de Vercel.
   * Agregar las variables de entorno (`DATABASE_URI`, `PAYLOAD_SECRET`, etc.).
   * ¡Listo! Despliegues automáticos en cada `git push`.

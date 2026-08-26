# 🚀 Guía de Lanzamiento a Producción & Roadmap por Seasons
**Proyecto:** StoreLink SaaS / Flow Martes  
**Fecha:** 26 de Agosto de 2026  
**Estado:** Base de código 100% auditada, tipada y con tests en verde (`65/65 tests`).

---

## 👥 1. Matriz de Responsabilidades: ¿Quién hace qué?

Para llevar el proyecto a producción y ejecutar las siguientes Seasons de forma ordenada, las responsabilidades quedan divididas entre lo que requiere **accesos a paneles externos** (tú) y lo que es **ingeniería y código** (yo).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DIVISIÓN DE TAREAS                                 │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ 👤 USUARIO (Paneles y Credenciales)  │ 🤖 AGENTE IA (Código e Ingeniería)   │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ • Descargar Certificado CA Supabase  │ • Crear Workflow de GitHub Actions   │
│ • Cargar variables en Vercel         │ • Desarrollar vista "Mi Tienda"      │
│ • Configurar Secretos en GitHub      │ • Optimizar imágenes con next/image  │
│ • Configurar DNS en registrador      │ • Implementar paginación infinita    │
│ • Crear listas/tableros en Trello    │ • Desarrollar Webhooks Trello        │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

### 👤 Tareas que debes hacer TÚ (En Dashboards Externos)

| # | Plataforma | Acción Requerida | Instrucción Detallada |
| :-: | :--- | :--- | :--- |
| **1** | **Supabase** | Obtener el Certificado SSL | Entrar a **Project Settings** → **Database** → **SSL Configuration** → Descargar el archivo `.crt` o copiar el texto PEM. |
| **2** | **Vercel** | Añadir variable `SUPABASE_CA_CERT` | En **Project Settings** → **Environment Variables**, pegar el texto del certificado como `SUPABASE_CA_CERT` en Production y Preview. |
| **3** | **GitHub** | Configurar Secretos del Runner | En el repo de GitHub → **Settings** → **Secrets and variables** → **Actions**, crear: <br>• `CRON_SECRET`: la misma clave secreta de tu `.env`<br>• `APP_URL`: `https://flow.martes.app` |
| **4** | **DNS / Dominio** | Apuntar el dominio oficial | Crear registro CNAME en tu proveedor de dominio: <br>`flow.martes.app` → `cname.vercel-dns.com`. |
| **5** | **Trello** | Crear Lista para la primera tienda | En el tablero de Trello del comercio, copiar el ID de 24 caracteres de la columna "Pendientes" y colocarlo en `trelloConfig.listId` del tenant. |

---

### 🤖 Tareas que puedo hacer YO (Código e Implementación)

| # | Módulo | Entregable Técnico |
| :-: | :--- | :--- |
| **1** | **DevOps / CI** | Crear el workflow `.github/workflows/payload-jobs-runner.yml` para disparar reintentos de jobs y purga de fallidos. |
| **2** | **Merchant Admin** | Construir la vista nativa *"Ajustes de Mi Tienda"* en el dashboard para que los comercios editen sus pagos (Pago Móvil, Zelle, Binance), pickup y logos. |
| **3** | **Performance** | Migrar etiquetas `<img>` de temas visuales a `<Image />` de Next.js para mejorar el Core Web Vitals (LCP). |
| **4** | **Escalabilidad** | Implementar paginación con cursor / `hasNextPage` en el storefront para catálogos masivos (>500 productos). |
| **5** | **Automatización** | Crear el Route Handler para Webhooks de Trello y sincronizar estados en tiempo real hacia Payload. |

---

## 🔒 2. Cómo Configurar el Certificado SSL de Supabase (`SUPABASE_CA_CERT`)

Para garantizar que la conexión con el Transaction Pooler (puerto 6543) esté totalmente cifrada con verificación estricta de Autoridad Certificadora (`rejectUnauthorized: true`):

### Paso 1: Descargar el Certificado desde Supabase
1. Ingresa a tu proyecto en [supabase.com/dashboard](https://supabase.com/dashboard).
2. Ve a **Project Settings** (ícono de engranaje) → **Database**.
3. Baja hasta la sección **SSL Configuration**.
4. Haz clic en **Download Certificate** (descargará un archivo como `prod-ca-2021.crt`).
5. Abre ese archivo con cualquier editor de texto (TextEdit, VS Code). Verás algo como:
   ```text
   -----BEGIN CERTIFICATE-----
   MIIEQzCCAyugAwIBAgIUQ...
   ...
   -----END CERTIFICATE-----
   ```

### Paso 2: Añadirlo a Vercel
1. Ingresa a tu proyecto en [vercel.com](https://vercel.com).
2. Ve a **Settings** → **Environment Variables**.
3. Crea la variable:
   - **Key:** `SUPABASE_CA_CERT`
   - **Value:** Pega todo el contenido del certificado (incluyendo `-----BEGIN CERTIFICATE-----` y `-----END CERTIFICATE-----`).
   - **Environments:** Marca **Production**, **Preview** y **Development**.
4. Haz clic en **Save**. En el próximo deploy, `payload.config.ts` activará automáticamente la validación SSL completa.

---

## ⚙️ 3. Configuración del Runner de Jobs (GitHub Actions)

Dado que en Vercel Hobby los Cron Jobs están limitados a 1 ejecución por día, el sistema cuenta con un endpoint oficial `/api/payload-jobs/run` y el purgador `/api/admin/cleanup-jobs` protegidos con `x-cron-secret`.

El runner corre automáticamente vía GitHub Actions cada 10 minutos para reintentar cualquier tarea fallida de Trello o Email.

---

## 🗓️ 4. Roadmap por Seasons

---

### 🌟 Season 1: Go-Live & Hardening de Producción (Semana Actual)
**Objetivo:** Poner el sistema en producción con todas las integraciones activas.

- [x] **Auditoría de seguridad y aislamiento multi-tenant aprobada.**
- [x] **Tests unitarios e integrados pasando al 100% (`65/65`).**
- [ ] **Configurar `SUPABASE_CA_CERT` en Vercel.** *(Usuario)*
- [ ] **Crear el Workflow de GitHub Actions para el Jobs Runner.** *(Agente)*
- [ ] **Configurar Secretos `CRON_SECRET` y `APP_URL` en GitHub.** *(Usuario)*
- [ ] **Despliegue a producción y prueba de compra E2E por WhatsApp.** *(Conjunto)*

---

### 🛍️ Season 2: Merchant Self-Serve & Store Settings (Semana 2 - 3)
**Objetivo:** Permitir al comerciante gestionar sus propios métodos de pago, pickup y branding sin requerir asistencia técnica.

- [ ] **Componente "Ajustes de Mi Tienda" en Admin:**
  - Formulario en `/admin/store-settings` donde el comerciante edita su teléfono de WhatsApp, datos de Pago Móvil (banco, cédula, teléfono), Zelle, Zinli, Binance Pay y Banesco Panamá.
- [ ] **Editor de Zonas de Delivery:**
  - Agregar, editar y desactivar zonas de cobertura y costos de envío.
- [ ] **Previsualizador de Catálogo:**
  - Vista previa en tiempo real del catálogo con el tema seleccionado.

---

### ⚡ Season 3: Core Web Vitals, Rendimiento & Catálogos Grandes (Semana 4 - 5)
**Objetivo:** Carga instantánea en conexiones 3G/4G y soporte de +1,000 productos.

- [ ] **Migración a `next/image`:**
  - Reemplazar `<img>` por `<Image />` con loader optimizado para Cloudflare R2 y Unsplash.
- [ ] **Paginación Infinita con Intersection Observer:**
  - En lugar de traer 500 productos fijos, cargar lotes de 24 con scroll infinito.
- [ ] **Optimizaciones de Service Worker (PWA):**
  - Cacheo inteligente de assets estáticos y categorías para apertura instantánea en móviles.

---

### 🔄 Season 4: Automatizaciones Avanzadas & Ecosistema (Semana 6+)
**Objetivo:** Integraciones bidireccionales y herramientas de gestión comercial.

- [ ] **Webhook Bidireccional de Trello:**
  - Escuchar eventos de Trello cuando una tarjeta se mueva a "Entregado" para actualizar la colección `Orders` en tiempo real.
- [ ] **Exportación Contable / Conciliación:**
  - Exportar pedidos a Excel/CSV con el desglose en USD y en Bs. según el snapshot de la tasa.
- [ ] **Notificaciones Web Push:**
  - Alertas sonoras y visuales en el teléfono del comerciante al entrar un pedido.

---

## 🏁 Próximo Paso Recomendado

Para empezar de inmediato con la **Season 1**, puedo crear ahora mismo el archivo del workflow de **GitHub Actions** (`.github/workflows/payload-jobs-runner.yml`) mientras tú configuras el certificado en Supabase y Vercel. ¿Deseas que proceda con la creación del workflow?

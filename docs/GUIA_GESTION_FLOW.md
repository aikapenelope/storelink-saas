# 📘 Manual Operativo Maestro: Plataforma Flow en martes.app

Guía oficial paso a paso para administrar la plataforma, dar de alta nuevos comercios (*tenants*), cargar inventarios masivos y ejecutar pruebas *End-to-End* (E2E) completas desde la interfaz.

---

## 1. 🌐 Mapa de Infraestructura y Accesos

| Módulo | URL de Acceso | Descripción |
| :--- | :--- | :--- |
| **Plataforma Flow** | [`https://flow.martes.app`](https://flow.martes.app) | Landing comercial oficial de la solución. |
| **Panel Maestro / Admin** | [`https://flow.martes.app/admin`](https://flow.martes.app/admin) | Panel de control central para Super Admins y Comerciantes. |
| **Tiendas de Comercios** | `https://[slug].martes.app` | Tienda PWA de cada cliente (ej: `donluigi.martes.app`). |

---

## 2. 🚀 Paso a Paso: Crear tu Primer Comercio (*Tenant*)

Sigue este procedimiento para dar de alta a un cliente en menos de 3 minutos:

### Procedimiento en la UI:

#### Paso 1: Iniciar Sesión como Super Admin
1. Entra en [`https://flow.martes.app/admin`](https://flow.martes.app/admin).
2. Ingresa con tu correo y contraseña de Super Administrador.

#### Paso 2: Crear el Registro del Comercio (*Tenant*)
1. En el menú lateral izquierdo, haz clic en **Comercios (Tenants)** ➔ **Crear Nuevo**.
2. **Campos Principales:**
   - **Nombre del Comercio:** Nombre comercial (ej: `Don Luigi & Burgers` o `Ferretería El Tornillo`).
   - **Slug (Subdominio):** El identificador web único (ej: `donluigi` o `eltornillo`).
     > Este slug definirá su enlace público: `https://donluigi.martes.app`.
   - **Teléfono WhatsApp:** Número con código internacional (ej: `584141234567`) donde el comercio recibirá los pedidos.
   - **Tema Visual:** Selecciona la plantilla visual acorde a su nicho:
     - `food-delivery` (Restaurantes, comida rápida, hamburgueserías)
     - `hardware-store` (Ferreterías, repuestos, herramientas)
     - `motorcycle-shop` (Motos, repuestos automotrices)
     - `fashion-boutique` (Ropa, calzado, accesorios)
     - `modern-minimal` (E-commerce genérico multipropósito)
   - **Tasa de Cambio Manual (Opcional):** Si el cliente quiere una tasa fija en Bolívares (ej: `75.00`), ingrésala aquí. Si la dejas vacía, el sistema tomará la tasa en vivo de **Binance P2P**.

#### Paso 3: Configurar Métodos de Pago
Despliega la sección **Configuración de Métodos de Pago**:
- **Pago Móvil:** Banco, Teléfono y Cédula/RIF receptores.
- **Zelle:** Correo electrónico y Titular.
- **Binance Pay:** Pay ID o correo asociado.
- **Zinli / Banesco Panamá / Efectivo:** Activa los que apliquen.

#### Paso 4: (Opcional) Configuración BYOK de Notificaciones
- **Resend (Email):** Pega la API Key del cliente si desea que los correos salgan desde su propio dominio.
- **Trello:** Ingresa su API Key, Token y ID de Lista para que sus pedidos caigan en su tablero Kanban.

#### Paso 5: Crear el Usuario para el Comerciante
1. Ve a la colección **Usuarios (Users)** ➔ **Crear Nuevo**.
2. Ingresa su **Email** y asígnale una **Contraseña**.
3. En **Rol**, selecciona `Comerciante (Admin de Tienda)`.
4. En el campo **Tenants**, selecciónale el comercio que acabas de crear.
5. Haz clic en **Guardar**.

---

## 3. 📦 Paso a Paso: Cargar el Catálogo de Productos

### Sincronización en 1 Clic con Google Sheets (Recomendado)

1. **Estructura de la Hoja de Google Sheets:**
   Crea una hoja de cálculo en Google Sheets con los siguientes encabezados exactos en la **Fila 1**:

   | sku | title | price | category | stockQuantity | description |
   | :--- | :--- | :---: | :--- | :---: | :--- |
   | `HAM-01` | Hamburguesa Bacon Doble | `8.50` | Hamburguesas | `50` | Doble carne 150g, queso cheddar y tocineta crocante |
   | `BEB-02` | Refresco Coca-Cola 1.5L | `2.50` | Bebidas | `100` | Botella plástica descartable |
   | `EXT-03` | Ración de Papas Rústicas | `3.00` | Extras | `30` | Con salsa tártara de la casa |

2. **Hacer pública la hoja:**
   - En Google Sheets, ve a **Archivo** ➔ **Compartir** ➔ **Publicar en la web**.
   - O en el botón azul **Compartir**, cambia el acceso a *"Cualquier persona con el enlace puede ser Lector"*.
   - Copia la URL de tu navegador (ej: `https://docs.google.com/spreadsheets/d/.../edit`).

3. **Ejecutar la Sincronización:**
   - Inicia sesión en [`https://flow.martes.app/admin`](https://flow.martes.app/admin).
   - En la tarjeta **"Sincronización de Catálogo en 1 Clic (Google Sheets)"**, pega la URL copiada.
   - Haz clic en **Sincronizar Ahora**.

---

## 4. 🧪 Prueba End-to-End (E2E) Completa desde la UI

### Fase 1: La Experiencia del Comprador (Front-End)
1. Abre en tu navegador la URL de la tienda: `https://[slug].martes.app` (ej: `https://flow.martes.app/demo`).
2. **Navega y Agrega Productos:**
   - Selecciona un producto (ej: Hamburguesa Bacon).
   - Haz clic en **"Agregar al Carrito"** y ajusta la cantidad a 2.
3. **Abre el Carrito:**
   - Toca el botón flotante del carrito en la esquina inferior derecha.
   - Observa el desglose automático: Total en **USD $** y su equivalente exacto en **Bs. VES**.
4. **Completa los Datos de Despacho y Pago:**
   - **Nombre:** `Carlos Gómez`
   - **Teléfono:** `04121234567`
   - **Email:** `tu-correo@gmail.com`
   - **Modalidad:** Selecciona 🛵 *Delivery* e ingresa *Municipio Chacao, Calle Uslar, Edif. Centro*.
   - **Método de Pago:** Selecciona *Pago Móvil* (ingresa referencia `987654`).
5. **Confirmar Pedido:**
   - Haz clic en el botón verde **"Confirmar y Enviar por WhatsApp"**.

### Fase 2: Validaciones Automáticas del Sistema
Al hacer clic, el sistema ejecuta en tiempo real:
- ✅ **WhatsApp:** Se abre la app de WhatsApp con el mensaje estructurado completo listo para enviar.
- ✅ **Nota de Entrega PDF:** Se descarga automáticamente el documento PDF profesional con el número de pedido `#ORD-...`, desglose en $ y Bs, datos de entrega y códigos de barras.
- ✅ **Correo Electrónico:** Se despacha un email formal con el PDF adjunto al correo del cliente.
- ✅ **Trello:** Se crea la tarjeta en la columna de pedidos pendientes.
- ✅ **Descuento de Inventario:** Se restan 2 unidades del stock del producto en Supabase.

### Fase 3: La Experiencia del Comerciante (Back-End / Admin)
1. Entra a [`https://flow.martes.app/admin`](https://flow.martes.app/admin) con el usuario del comercio.
2. Observa el **Merchant Dashboard**:
   - **Ventas de Hoy:** La cifra aumentó instantáneamente en **$ USD** y **Bs. VES**.
   - **Pedidos Recientes:** Aparece la orden `#ORD-...` de *Carlos Gómez* con modalidad *Delivery (Chacao)* y estado *Pendiente*.
   - **Mini CRM:** *Carlos Gómez* aparece registrado con su teléfono y el badge correspondente.
   - **Botón de WhatsApp en 1 Clic:** Haz clic en el botón *"Escribir WhatsApp"* del CRM y comprueba cómo se abre el chat con el mensaje listo.
3. **Gestión del Pedido:**
   - Haz clic en **"Gestionar"** en la fila del pedido.
   - Cambia el estado de `Pendiente` a `En Camino / Delivery` o `Entregado`.
   - Haz clic en **Guardar**.

# Constitución de Ingeniería — StoreLink SaaS

Protocolo no negociable de trabajo sobre este repositorio. Aplica a TODO cambio de código, sin excepción. Cualquier interacción de código es una operación de ingeniería de precisión sobre código de producción.

**Principio rector:** todo lo que escribas aquí tiene consecuencias reales (checkouts, inventario, pagos, datos de comercios). No hay proyectos sandbox.

---

## 1. Invariantes (No Negociables)

### 1.1 100% Framework-Native — Cero Hacks
- Todo el código debe operar con las APIs oficiales de **Next.js 15, Payload CMS 3.x, Supabase y Vercel**.
- Antes de escribir lógica personalizada (auth, plugins, storage, multi-tenant, SEO, migraciones, pagos), verificar SIEMPRE si existe un plugin oficial `@payloadcms/*` (aquí ya se usan: `plugin-multi-tenant`, `plugin-seo`, `storage-s3`, `email-resend`, `richtext-lexical`, `db-postgres`) o un estándar documentado (Context7 / docs oficiales).
- Prohibido: monkey-patches, editar `node_modules`, wrappers inventados que eludan el ciclo de vida oficial, SQL crudo que salte hooks de Payload.
- Si un caso límite exige desviarse del estándar, presentarlo al usuario y obtener aprobación explícita ANTES de escribir código.

### 1.2 Cero Edición Ciega (Zero Blind Edits)
- PROHIBIDO modificar un archivo sin comprender su contexto y su **blast radius** (radio de impacto).
- Antes de cambiar una función/tipo/constante, identifica qué módulos, endpoints o colecciones dependen de ella.

### 1.3 Preservación Estricta y No Destructiva
- Prohibido reemplazar código con `// ... resto igual`.
- Prohibido silenciar TypeScript con `any`, `as unknown as any` o `@ts-ignore` sin justificación explícita documentada.
- Respetar la base preexistente: no borrar comentarios explicativos, configuraciones ni utilidades en uso.

### 1.4 Contraste de Alternativas
- Para decisiones arquitectónicas de complejidad media/alta: contrastar al menos **2 alternativas viables** (A vs B) y justificar la elegida en rendimiento, mantenibilidad, compatibilidad serverless y seguridad de tipos.

---

## 2. Reglas Específicas del Stack

### Next.js 15 / React 19 (App Router)
- En `page.tsx` y `layout.tsx`, `params` y `searchParams` SIEMPRE son Promesas (`params: Promise<{ slug: string }>`). Jamás desestructurar síncronamente.
- Mantener Server Components limpios de hooks; marcar `'use client'` solo en las hojas interactivas del árbol.
- Validar TODA entrada en el servidor (Server Actions / API routes) con esquemas tipados o chequeos explícitos; respuestas estructuradas `{ success, error?, data? }`.
- Storefront (`src/app/(app)/[tenant]/`) es SSR dinámico a propósito; no convertirlo a estático sin evaluar latencia.

### Payload CMS 3.x
- **Sincronización de tipos obligatoria:** cada cambio en `src/collections/*.ts` debe reflejarse en `src/payload-types.ts` con `pnpm generate:types` (no editar el archivo generado a mano).
- **Aislamiento multi-tenant:** toda consulta a colecciones de tenant debe ir filtrada por el tenant del usuario (`where: { tenant: { equals } }`), salvo `super-admin`. El array `tenants` de users y la creación de tenants son solo de `super-admin` (ya blindado en `payload.config.ts` con `tenantsArrayField.arrayFieldAccess`).
- **Datos sensibles:** los datos de pago de comercios (`paymentMethodsConfig`) solo se leen con sesión activa; nunca exponerlos por API pública ni en Server Components del storefront.
- **Inventario:** usar el operador atómico oficial `$inc` para descuentos de stock (no read-modify-write); evitar sobreventa.
- `payload.config.ts` tiene `push: false`: los cambios de esquema se aplican SOLO vía migraciones explícitas, nunca con auto-push.

### Supabase (Postgres) & Vercel Serverless
- **Runtime:** conexiones vía **Transaction Pooler puerto 6543** (ya configurado: `DATABASE_URI`, pool `max: 10`). No usar la conexión directa 5432 en runtime.
- **Migraciones:** ejecutar SIEMPRE por conexión directa, NUNCA por pooler (no soporta DDL en modo transacción).
- **Caché/revalidación:** usar `revalidateTag`/`revalidatePath` para que los datos no queden obsoletos en el CDN de Vercel.
- **Coste/rendimiento serverless:** evitar N+1 y queries innecesarias; no agotar cuotas ni el pool.

---

## 3. Protocolo de Ejecución en 5 Fases

```
FASE 0 · INVESTIGACIÓN DEL ECOSISTEMA
  - ¿Existe plugin oficial @payloadcms/* o estándar documentado (Context7)?
  - Si requiere workaround → consultar al usuario ANTES.

FASE 1 · AUDITORÍA DE CONTRATOS & BLAST RADIUS
  - Mapear dependencias cruzadas, tipos afectados y endpoints dependientes.

FASE 2 · PLANIFICACIÓN Y CONTRASTE
  - Comparar ≥2 alternativas; definir plan atómico y rollback.

FASE 3 · IMPLEMENTACIÓN QUIRÚRGICA
  - Cambio mínimo y exacto con APIs oficiales; preservar firmas e imports.

FASE 4 · VERIFICACIÓN & CALIDAD
  - pnpm lint + pnpm build + generate:types + revisión de migraciones.
```

---

## 4. Migraciones & Seguridad de Base de Datos

Las migraciones son la operación de mayor riesgo del proyecto. Sin excepción:

- Crear con `pnpm migrate:create`; revisar el SQL generado a mano ANTES de aplicar (`pnpm migrate`).
- Prohibido añadir una columna `NOT NULL` sin valor por defecto.
- Prohibido dropear columnas directamente: usar **expand/contract** (añadir → migrar datos → actualizar código → dropear en migración separada).
- Índices en producción con `CREATE INDEX CONCURRENTLY` para evitar bloqueos de tabla.
- Probar migraciones en copia/staging antes de producción cuando sea posible.

---

## 5. Commits y Control de Versiones

- **Atomic commits:** un cambio lógico por commit; jamás mezclar cambios no relacionados.
- Formato convencional (ya usado en el repo): `type(scope): description` — ej. `fix(security): restrict tenants to super-admin`, `refactor(inventory): use $inc atomic operator`.
- Commit antes de cada hito significativo: cada commit es un punto de rollback.

---

## 6. Herramientas y Delegación del Agente

- **Context7:** para APIs de librerías externas (Payload, Next, supabase-js, jsPDF). NO para el código propio del proyecto.
- **@scout:** para inspeccionar el código fuente real de una dependencia cuando haya duda de comportamiento.
- **@security-auditor:** auditoría de seguridad (RLS/aislamiento de tenants, exposición de datos, validación de inputs, secrets). Read-only.
- **@code-reviewer:** revisión de calidad/correctitud/rendimiento del stack. Read-only.
- **Tareas multi-paso:** descomponer con `todo`; trabajo de investigación paralelo a subagentes con scope preciso y formato de reporte definido.

---

## 7. Anti-Patterns (Prohibidos)

| Anti-Pattern | En su lugar |
|---|---|
| Hot-fix sin entender la causa raíz | Diagnóstico → plan mínimo → implementar → verificar |
| Editar sin analizar blast radius | `find_referencing_symbols` / grep de usos antes de tocar |
| `any` / `@ts-ignore` para silenciar | Tipar fielmente o justificar por escrito |
| SQL crudo saltando hooks/validación | APIs de Payload (`getPayload`, `$inc`, hooks oficiales) |
| Inventario read-modify-write | `$inc` atómico |
| Migraciones por pooler / auto-push | Conexión directa + migración revisada |
| Drops directos de columnas | Expand/contract |
| Mezclar cambios no relacionados en un commit | Atomic commits |
| Cargar secretos en contexto/código | Variables de entorno; nunca exponer valores |
| Asumir estructura de un archivo | Verificar antes de editar |
| Autoverificar el propio trabajo | `pnpm lint` / `pnpm build` / `@code-reviewer` |

---

## 8. Checklist de Entrega

- [ ] ¿Se usó la solución oficial del framework sin parches inventados?
- [ ] ¿Se verificó si existía plugin `@payloadcms/*` antes de programar desde cero?
- [ ] ¿TypeScript compila sin errores ni `any` encubiertos (`pnpm build` / `pnpm lint`)?
- [ ] ¿Se regeneró `payload-types.ts` si cambiaste colecciones?
- [ ] ¿Se preservaron firmas e imports preexistentes?
- [ ] ¿Sin llamadas síncronas a APIs asíncronas de Next 15 (`params`, `searchParams`)?
- [ ] ¿Aislamiento multi-tenant y datos de pago protegidos?
- [ ] ¿Migraciones revisadas a mano y rollback definido?
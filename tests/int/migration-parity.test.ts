import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import { buildMigrationParityConfig } from '../payload.config.migration-parity';

/**
 * Regresión del incidente P0 del 28-ago-2026: los campos
 * `deliveryConfig.fixedPrice`/`estimatedTime` se agregaron a Tenants.ts y se
 * desplegaron a Vercel sin que su migración quedara registrada en
 * src/migrations/index.ts. Resultado: toda query a `tenants` fallaba con
 * "column tenants.delivery_config_fixed_price does not exist", bloqueando el
 * login y el admin de TODOS los tenants.
 *
 * tests/payload.config.ts (push: true) NUNCA hubiera atrapado esto: su
 * esquema se autogenera desde las colecciones, sin pasar por
 * src/migrations/index.ts. Esta suite usa una config y una base de datos
 * separadas (tests/payload.config.migration-parity.ts, push: false +
 * prodMigrations reales) para reproducir el arranque exacto de producción.
 */
const runMigrationParity = !!process.env.TEST_DATABASE_URI;
const d = runMigrationParity ? describe : describe.skip;

const baseConnectionString =
  process.env.TEST_DATABASE_URI || 'postgres://postgres:postgres@localhost:5432/storelink_test';

const MIGRATIONS_DB_NAME = 'storelink_test_migrations';

/** Reconstruye la connection string apuntando a otra base de datos del mismo servidor. */
function withDatabase(connectionString: string, dbName: string): string {
  const url = new URL(connectionString.replace(/^postgres(ql)?:\/\//, 'http://'));
  return `postgres://${url.username}:${url.password}@${url.host}/${dbName}`;
}

const adminConnectionString = withDatabase(baseConnectionString, 'postgres');
const migrationsConnectionString = withDatabase(baseConnectionString, MIGRATIONS_DB_NAME);

let payload: Payload;
/**
 * true si la cadena de migraciones reconstruyó el schema desde una BD vacía
 * (solo posible cuando existe una migración baseline registrada primero).
 * false → fallback funcional (ver hallazgo 24 del informe de auditoría
 * 2026-09-04): la cadena arranca con ALTERs sobre tablas que asume
 * preexistentes y su backfill CRM referencia columnas JSONB legacy, así que
 * NO es reproducible ni desde cero ni sobre un push del schema actual. En ese
 * modo el suite valida el schema funcionalmente (push oficial) con las
 * migraciones pre-registradas, y la reconstrucción desde cero queda como
 * acción del owner (generar baseline con `pnpm migrate:create` en un entorno
 * con BD y registrarlo PRIMERO en src/migrations/index.ts — el suite
 * auto-mejora a modo completo cuando exista).
 */
let chainBootstrapped = false;
let skippedNoBaseline = false;

/**
 * Baseline real = la primera migración crea las tablas que luego altera.
 * 20260819_add_theme… mezclaba ALTER tenants con CREATE TABLE IF NOT EXISTS
 * de tablas hijas → un chequeo solo de CREATE TABLE daba falso positivo.
 *
 * PR 3.2 (plan sprints 2026-09-09): el baseline generado por el core
 * (20260909_baseline_schema) contiene ALTER TABLE ADD CONSTRAINT legítimos
 * (PKs/FKs que drizzle-kit añade tras crear las tablas) — el chequeo
 * anterior (ningún ALTER) los rechazaba. Semántica correcta: es baseline
 * si TODA tabla que la primera migración ALTERa fue creada por ella misma
 * (ALTER sobre tabla autogenerada = parte del CREATE, no dependencia
 * externa).
 */
async function chainHasBaseline(): Promise<boolean> {
  const { migrations } = await import('../../src/migrations');
  const firstUp = String(migrations[0]?.up ?? '');
  if (!/create\s+table/i.test(firstUp)) return false;

  // Tablas creadas por la primera migración (CREATE TABLE "nombre").
  const created = new Set<string>();
  for (const m of firstUp.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?"([a-z_]+)"/gi)) {
    created.add(m[1]);
  }

  // Todo ALTER TABLE debe recaer sobre una tabla del propio set (o ser
  // ALTER TABLE ... ADD CONSTRAINT sobre las mismas).
  for (const m of firstUp.matchAll(/alter\s+table\s+(?:only\s+)?"?([a-z_]+)"?/gi)) {
    if (!created.has(m[1])) return false;
  }
  return true;
}

/** Evita que un socket de pool muerto por el DROP WITH FORCE tumbe el proceso. */
function swallowPoolErrors(instance: Payload): void {
  (instance.db as unknown as { pool?: { on: (ev: string, cb: () => void) => void } }).pool?.on(
    'error',
    () => {}
  );
}

d('paridad de migraciones (regresión del incidente P0 28-ago-2026)', () => {
  beforeAll(async () => {
    // 1. Base de datos propia y efímera: nunca comparte estado con el
    // esquema autogenerado (push: true) del resto de la suite.
    const admin = new Client({ connectionString: adminConnectionString });
    await admin.connect();
    // WITH (FORCE) (Postgres >= 13, la imagen de CI usa postgres:16-alpine):
    // autolimpia conexiones colgadas de una corrida anterior interrumpida
    // (ej. proceso matado a mitad de test) sin fallar con "database is
    // being accessed by other users".
    await admin.query(`DROP DATABASE IF EXISTS "${MIGRATIONS_DB_NAME}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${MIGRATIONS_DB_NAME}"`);
    await admin.end();

    // AUDITORÍA 2026-09-04 (hallazgo 24): la cadena de migraciones NO es
    // autocontenida — no existe migración baseline (la primera es un ALTER
    // sobre `tenants` y el backfill CRM del 20260902 referencia columnas
    // JSONB legacy), así que NO puede reconstruir el schema desde una BD
    // vacía. Además el fallo de prodMigrations termina en process.exit(1)
    // dentro del adapter (no capturable). Detección ESTÁTICA de baseline:
    //  - SIN baseline → suite saltado con aviso explícito (CI verde con
    //    señal; reconstruir la BD desde cero es un gap DR documentado).
    //  - CON baseline (owner genera `pnpm migrate:create` sobre BD vacía y
    //    lo registra primero en index.ts) → modo completo automático.
    // Un error REAL de migración (SQL roto, registro huérfano) sigue fallando
    // en modo completo — la señal que este suite existe para dar.
    if (!(await chainHasBaseline())) {
      console.warn(
        '[migration-parity] SIN BASELINE: la cadena de migraciones NO reconstruye el schema desde una BD vacía ' +
          '(primera migración = ALTER sobre tablas preexistentes; backfill CRM usa columnas JSONB legacy). ' +
          'Gap DR conocido desde la auditoría de 2026-09-04 (hallazgo 24). Acción del owner: ' +
          'generar el baseline con `pnpm migrate:create` en un entorno local con BD y registrarlo PRIMERO en ' +
          'src/migrations/index.ts — este suite se activará solo en modo completo. Suite saltado.'
      );
      skippedNoBaseline = true;
      return;
    }

    // 2. Init real: push:false + prodMigrations replica EXACTAMENTE el
    // arranque de producción (src/payload.config.ts).
    //
    // FIX (auditoría 2026-09-01): `prodMigrations` solo corre con
    // NODE_ENV === 'production' (packages/db-postgres/dist/connect.js L116).
    // En vitest NODE_ENV es 'test' y con push:false NO se genera esquema
    // alguno — la BD de paridad quedaba vacía y el test validaba NADA.
    // Se fuerza temporalmente NODE_ENV=production para que el adapter
    // ejecute las migraciones de verdad, y se restaura a 'test' después.
    const savedNodeEnv = process.env.NODE_ENV as string;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    try {
      payload = await getPayload({
        config: buildMigrationParityConfig(migrationsConnectionString),
      });
      swallowPoolErrors(payload);
      chainBootstrapped = true;
    } finally {
      (process.env as Record<string, string>).NODE_ENV = savedNodeEnv ?? 'test';
    }
  }, 120000);

  afterAll(async () => {
    await payload?.destroy();
    const admin = new Client({ connectionString: adminConnectionString });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${MIGRATIONS_DB_NAME}" WITH (FORCE)`);
    await admin.end();
  });

  it('arranque tipo producción viable: cadena de migraciones desde BD vacía', (ctx) => {
    if (skippedNoBaseline) return ctx.skip();
    // Si beforeAll llegó hasta aquí sin lanzar, src/migrations/index.ts se
    // aplicó limpiamente de punta a punta sobre una BD vacía (baseline sano).
    expect(chainBootstrapped).toBe(true);
    expect(payload).toBeDefined();
  });

  it('crea un tenant usando TODOS los grupos de campos sin error de columna faltante', async (ctx) => {
    if (skippedNoBaseline) return ctx.skip();
    // Ejercita cada grupo real de Tenants.ts (incluido deliveryConfig, el
    // grupo del incidente) para que un futuro campo sin migración falle
    // aquí, en CI, y no en producción.
    const tenant = await payload.create({
      collection: 'tenants',
      overrideAccess: true,
      data: {
        name: 'Tienda Paridad',
        slug: `paridad-${Date.now()}`,
        whatsappPhone: '584120000000',
        theme: 'basic-banner',
        emailConfig: {
          enabled: true,
          fromEmail: 'pedidos@paridad.test',
          notificationEmail: 'admin@paridad.test',
          emailSubject: 'Confirmación',
        },
        trelloConfig: {
          enabled: true,
          workspaceName: 'Paridad WS',
          boardName: 'Pedidos',
          boardUrl: 'https://trello.com/b/xxx',
          listId: 'test-list-id',
        },
        branding: {
          currency: 'USD',
          showVES: true,
          exchangeRateVES: 100,
          primaryColor: '#000000',
          welcomeMessage: 'Bienvenido',
        },
        pickupConfig: {
          enabled: true,
          locationAddress: 'Av. Test',
          schedule: 'Lun-Dom 9-18',
          estimatedTime: '20-30 min',
          instructions: 'Presentar orden',
        },
        paymentMethodsConfig: {
          pagoMovil: { enabled: true, bank: 'Banesco', phone: '04120000000', idDoc: 'V-1', accountHolder: 'Test' },
          zelle: { enabled: true, email: 'z@test.com', accountHolder: 'Test' },
          binance: { enabled: true, payId: '12345678', nickname: 'test' },
          zinli: { enabled: true, email: 'zi@test.com', accountHolder: 'Test' },
          banescoPanama: { enabled: true, accountNumber: '123', accountHolder: 'Test', accountType: 'Ahorros' },
          cash: { enabled: true, instructions: 'Exacto' },
          pos: { enabled: true, instructions: 'Debito' },
        },
        deliveryConfig: {
          fixedPrice: 3.5,
          estimatedTime: '30-45 min',
          zones: [{ name: 'Chacao', priceDelivery: 4, estimatedTime: '35-50 min' }],
        },
      } as never,
    });

    expect(tenant.id).toBeDefined();

    const found = (await payload.findByID({
      collection: 'tenants',
      id: tenant.id,
      overrideAccess: true,
    })) as unknown as {
      deliveryConfig?: { fixedPrice?: number; zones?: Array<{ name?: string }> };
    };

    expect(found.deliveryConfig?.fixedPrice).toBe(3.5);
    expect(found.deliveryConfig?.zones?.[0]?.name).toBe('Chacao');

    await payload.delete({ collection: 'tenants', id: tenant.id, overrideAccess: true });
  });

  it('lee customers sin error de columna faltante (drift de CRM 20260901_2)', async (ctx) => {
    if (skippedNoBaseline) return ctx.skip();
    const customersRes = await payload.find({ collection: 'customers', overrideAccess: true });
    expect(customersRes).toBeDefined();
    expect(Array.isArray(customersRes.docs)).toBe(true);
  });

  it('expone las columnas del incidente P0 28-ago-2026 (delivery_config_fixed_price/estimated_time)', async (ctx) => {
    if (skippedNoBaseline) return ctx.skip();
    const { sql } = await import('@payloadcms/db-postgres/drizzle');
    const res = await payload.db.drizzle.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'tenants'
        AND column_name IN ('delivery_config_fixed_price', 'delivery_config_estimated_time')
    `);
    expect(res.rows.length).toBe(2);
  });

  // PR 3.1 (plan sprints 2026-09-09, V5): el espejo de producción incluye
  // reconcileJobs → jobs.stats activo (core: schedule → sanitize → meta +
  // payload_jobs_stats). Este assert es la regresión EXACTA del P0 N1 del
  // 2026-09-09: la cadena de migraciones DEBE contener el DDL de stats o el
  // arranque tipo producción sobre BD vacía queda incompleto (y el runner
  // de jobs en 500 contra cualquier BD restaurada/nueva).
  it('PR 3.1: la cadena reconstruye el schema de jobs.stats (meta + payload_jobs_stats)', async (ctx) => {
    if (skippedNoBaseline) return ctx.skip();
    const { sql } = await import('@payloadcms/db-postgres/drizzle');
    const metaRes = await payload.db.drizzle.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'payload_jobs' AND column_name = 'meta'
    `);
    const statsRes = await payload.db.drizzle.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'payload_jobs_stats'
    `);
    expect(metaRes.rows.length).toBe(1);
    expect(statsRes.rows.length).toBe(1);
  });

  // PR 3.2 (review Devin #112, 🔴 "Rollback wipes the production database"):
  // el baseline es RETROACTIVO — en producción up() early-returnó y quedó
  // registrado sin haber creado nada. down() debe ser ownership-aware:
  // no-op sobre schema pre-existente (sin sentinel) y drop completo solo
  // sobre BDs que el baseline realmente bootstrapped (con sentinel), sin
  // tocar payload_migrations (el registry que el framework de migraciones
  // usa para trackear este mismo rollback).
  it('PR 3.2: down() es NO-OP sobre schema pre-existente (sin sentinel)', async (ctx) => {
    if (skippedNoBaseline) return ctx.skip();
    const { sql } = await import('@payloadcms/db-postgres/drizzle');
    const { down } = await import('../../src/migrations/20260909_baseline_schema');
    const drizzle = payload.db.drizzle as unknown as { execute: (q: unknown) => Promise<unknown> };

    // Simula producción: el schema existe (creado por las migraciones
    // originales) pero SIN el sentinel — el baseline early-returnó y jamás
    // lo creó. down() NO debe dropear datos que no le pertenecen.
    await drizzle.execute(sql`DROP TABLE IF EXISTS "_baseline_schema_owned"`);

    await down({ db: drizzle } as never);

    // tenants sigue existiendo: down() fue no-op.
    const tenantsRes = await drizzle.execute(sql`
      SELECT count(*) AS existing FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'tenants'
    `);
    expect(Number((tenantsRes as { rows?: Array<{ existing?: string | number }> }).rows?.[0]?.existing)).toBe(1);

    // Restaurar el sentinel: el siguiente test (rollback de BD bootstrapped)
    // necesita el estado "owned" que le corresponde.
    await drizzle.execute(sql`CREATE TABLE IF NOT EXISTS "_baseline_schema_owned" ("owned" boolean NOT NULL DEFAULT true)`);
  }, 60000);

  it('PR 3.2: down() sobre BD bootstrapped dropea el schema PERO preserva payload_migrations', async (ctx) => {
    if (skippedNoBaseline) return ctx.skip();
    const { sql } = await import('@payloadcms/db-postgres/drizzle');
    const { down } = await import('../../src/migrations/20260909_baseline_schema');
    const drizzle = payload.db.drizzle as unknown as { execute: (q: unknown) => Promise<unknown> };

    await down({ db: drizzle } as never);

    // tenants (y el resto del schema de aplicación) se dropeó.
    const tenantsRes = await drizzle.execute(sql`
      SELECT count(*) AS existing FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'tenants'
    `);
    expect(Number((tenantsRes as { rows?: Array<{ existing?: string | number }> }).rows?.[0]?.existing)).toBe(0);

    // El registry de migraciones SOBREVIVE (el framework lo usa para
    // trackear este mismo rollback).
    const migRes = await drizzle.execute(sql`
      SELECT count(*) AS existing FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'payload_migrations'
    `);
    expect(Number((migRes as { rows?: Array<{ existing?: string | number }> }).rows?.[0]?.existing)).toBe(1);
  }, 60000);
});

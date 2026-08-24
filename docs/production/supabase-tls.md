# TLS hacia Supabase — verificación de CA (`SUPABASE_CA_CERT`)

La conexión Postgres de Payload ya está preparada en `src/payload.config.ts`
para usar el modo recomendado por Supabase (**verify-full**): si la variable
`SUPABASE_CA_CERT` existe, se conecta con `rejectUnauthorized: true` y
verificación de la CA; si no existe, cae a cifrado sin verificación para no
romper entornos donde aún no esté configurada.

Este documento describe cómo cerrar ese último paso operacional.

## 1. Descargar el certificado CA

1. Supabase Dashboard → tu proyecto → **Settings → Database → SSL Configuration**.
2. Descarga el **CA Certificate** (PEM). Supabase publica dos:
   - `prod-ca-2021.crt` (CA intermedia, la que usa `verify-full`)
   - `prod-ca-2025-root.crt` (root, soportada en proyectos nuevos)
3. Referencia oficial: https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler

## 2. Configurar la variable en Vercel

```bash
vercel env add SUPABASE_CA_CERT production
```

Pega el contenido PEM completo del archivo descargado. El config ya normaliza
los saltos de línea literales (`\n`) del valor de entorno:

```
ssl: process.env.SUPABASE_CA_CERT
  ? { rejectUnauthorized: true, ca: process.env.SUPABASE_CA_CERT.replace(/\\n/g, '\n') }
  : { rejectUnauthorized: false }
```

> Alternativa por UI: Vercel → Project → Settings → Environment Variables →
> añadir `SUPABASE_CA_CERT` para Production y Preview con el contenido PEM.

## 3. Verificar

1. Redeploy (la variable solo se lee al iniciar).
2. En los logs no debe aparecer error de handshake TLS.
3. Prueba negativa (opcional): apuntar temporalmente `DATABASE_URI` a un host
   distinto con la misma CA → la conexión debe **fallar**; eso confirma que la
   verificación está activa.

## 4. Rotación

Supabase rota CAs periódicamente y avisa por email/dashboard. Al rotar:
descargar la nueva CA, actualizar `SUPABASE_CA_CERT` y redeploy antes de la
fecha límite indicada por Supabase para evitar cortes de conexión.

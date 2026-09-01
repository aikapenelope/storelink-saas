# Monitoreo de Resend - Guía de Configuración

## Objetivo
Monitorear los logs de Resend para detectar problemas con el envío de correos, uso cruzado de cuotas (BYOK), y fallos en la entrega de confirmaciones de pedidos.

## Problemas a Detectar

### 1. Uso Cruzado de Cuotas BYOK
**Síntoma**: Dos tenants con el mismo `fromEmail` consumiendo la cuota de uno de ellos.

**Detección**:
```bash
# Filtro en logs de Resend
from_email:"pedidos@mitienda.com" AND tenant_id:"diferente"
```

**Solución**: El unique constraint en `tenants.emailConfig.fromEmail` (migración 20260830) previene esto a nivel de BD.

### 2. Correos No Entregados
**Síntoma**: Confirmaciones de pedidos no llegan a los clientes.

**Detección**:
```bash
# Filtro en logs de Resend
event:"delivered"=false AND from_email:"pedidos@flow.martes.app"
```

**Causas comunes**:
- Dirección de correo inválida
- Buzón lleno
- Dominio marcado como spam

### 3. Errores de API Key
**Síntoma**: Error 401 Unauthorized en logs.

**Detección**:
```bash
# Filtro en logs de Resend
status_code:401
```

**Causas comunes**:
- API key revocada o expirada
- Error en configuración BYOK

## Configuración de Monitoreo

### Opción 1: Dashboard de Resend (Básico)

1. **Acceder al Dashboard**:
   - https://resend.com/dashboard
   - Seleccionar el proyecto correspondiente

2. **Configurar Alertas**:
   - Ir a Settings → Notifications
   - Configurar alertas para:
     - `Error rate > 5%` (alerta inmediata)
     - `Bounce rate > 2%` (alerta diaria)
     - `Complaint rate > 0.1%` (alerta inmediata)

3. **Filtros de Búsqueda**:
   - `from_email:"pedidos@flow.martes.app"` - correos del sistema global
   - `from_email:"pedidos@mitienda.com"` - correos de tenant específico
   - `event:"delivered"=false` - correos no entregados
   - `status_code:401` - errores de autenticación

### Opción 2: Integración con Slack/Discord (Recomendado)

**Webhook a Slack**:
```typescript
// src/app/api/webhooks/resend-alerts/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  
  // Filtrar eventos críticos
  if (body.type === 'email.bounced' || body.type === 'email.complained') {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 Alerta Resend: ${body.type}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Email:* ${body.data.email}\n*From:* ${body.data.from}\n*Reason:* ${body.data.reason}`
            }
          }
        ]
      })
    });
  }
  
  return NextResponse.json({ success: true });
}
```

**Configurar Webhook en Resend**:
1. Dashboard → Settings → Webhooks
2. Agregar URL: `https://flow.martes.app/api/webhooks/resend-alerts`
3. Seleccionar eventos: `email.bounced`, `email.complained`, `email.delayed`

### Opción 3: Exportación de Logs para Análisis

**Exportar logs CSV**:
```bash
# Desde dashboard de Resend
1. Logs → Export
2. Filtros: 
   - Fecha: últimos 7 días
   - Event: delivered, bounced, complained
   - From: tus dominios
3. Exportar como CSV
```

**Análisis con script**:
```typescript
// scripts/analyze-resend-logs.ts
import fs from 'fs';

const logs = JSON.parse(fs.readFileSync('resend-logs.json', 'utf-8'));

const byTenant = new Map<string, { sent: number; failed: number }>();

for (const log of logs) {
  const fromEmail = log.data.from;
  const tenant = fromEmail.split('@')[0]; // Asumiendo formato pedidos@tenant.com
  
  if (!byTenant.has(tenant)) {
    byTenant.set(tenant, { sent: 0, failed: 0 });
  }
  
  const stats = byTenant.get(tenant)!;
  if (log.type === 'email.delivered') {
    stats.sent++;
  } else {
    stats.failed++;
  }
}

console.log('Estadísticas por tenant:');
for (const [tenant, stats] of byTenant) {
  const total = stats.sent + stats.failed;
  const failureRate = total > 0 ? (stats.failed / total) * 100 : 0;
  console.log(`${tenant}: ${total} enviados, ${stats.failed} fallidos (${failureRate.toFixed(1)}%)`);
}
```

## Métricas Clave a Monitorear

### KPIs de Entrega
- **Delivery Rate**: `delivered / (delivered + bounced + dropped)` - Objetivo > 95%
- **Bounce Rate**: `bounced / total` - Objetivo < 2%
- **Complaint Rate**: `complained / total` - Objetivo < 0.1%
- **Open Rate**: `opened / delivered` - Objetivo > 40% (confirmaciones de pedido)

### KPIs de Performance
- **API Latency**: Tiempo de respuesta de API - Objetivo < 500ms p95
- **Queue Time**: Tiempo en cola antes de envío - Objetivo < 30s p95
- **Error Rate**: `errors / total` - Objetivo < 0.1%

## Procedimiento de Respuesta a Incidentes

### Escenario 1: Aumento Súbito de Bounces
**Acciones**:
1. Verificar si hay un dominio específico con problemas
2. Revisar reputación del dominio en tools like MXToolbox
3. Verificar si hay campaña marcada como spam
4. Considerar cambiar dominio de envío si el problema persiste

### Escenario 2: Errores 401 Intermitentes
**Acciones**:
1. Verificar validez de API keys en Vercel env vars
2. Revisar si hay rotación de keys en progreso
3. Verificar logs de BYOK para identificar tenant específico
4. Considerar regenerar API key si está comprometida

### Escenario 3: Correos Llegando Lentamente
**Acciones**:
1. Verificar queue times en logs de Resend
2. Revisar si hay spikes en volumen de envíos
3. Verificar si hay rate limiting activo
4. Considerar upgrade de plan de Resend si es necesario

## Integración con Vercel Analytics

Para monitoreo adicional en Vercel:

```typescript
// src/lib/email/resend-tenant-adapter.ts - modificado
export const resendTenantAdapter = (args: ResendTenantAdapterArgs): EmailAdapter<ResendResponse> =>
  ({ payload }: { payload: Payload }) => ({
    // ... código existente ...
    sendEmail: async (message) => {
      const startTime = Date.now();
      
      try {
        const res = await fetch('https://api.resend.com/emails', {
          // ... configuración existente ...
        });
        
        const duration = Date.now() - startTime;
        
        // Enviar a Vercel Analytics
        if (typeof window !== 'undefined' && window.va) {
          window.va('event', {
            name: 'resend_email_sent',
            data: {
              duration,
              from: message.from,
              to: message.to,
              success: res.ok
            }
          });
        }
        
        // ... resto del código ...
      } catch (error) {
        // Log error con duración
        console.error(`Resend error after ${Date.now() - startTime}ms:`, error);
        throw error;
      }
    },
  });
```

## Checklist de Monitoreo

### Diario
- [ ] Verificar delivery rate > 95%
- [ ] Revisar bounce rate < 2%
- [ ] Chequear que no haya errores 401
- [ ] Verificar queue times normales

### Semanal
- [ ] Exportar logs para análisis de tendencias
- [ ] Revisar open rates por tenant
- [ ] Verificar uso de cuotas BYOK
- [ ] Identificar dominios con problemas recurrentes

### Mensual
- [ ] Revisar reputación de dominios en herramientas externas
- [ ] Evaluar necesidad de upgrade de plan
- [ ] Revisar configuración de webhooks
- [ ] Actualizar documentación de procedimientos

## Recursos Adicionales

- **Documentación Resend**: https://resend.com/docs
- **API Reference**: https://resend.com/docs/api-reference
- **Best Practices**: https://resend.com/docs/best-practices
- **Webhooks Guide**: https://resend.com/docs/webhooks

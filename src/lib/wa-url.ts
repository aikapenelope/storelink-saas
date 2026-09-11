/**
 * Helper único de WhatsApp Venezuela (plan Analytics+CRM, thermo D2):
 * unifica las 4 copias del patrón `startsWith('58') ? … : \`58${…}\`` del repo
 * (checkout.ts, AnalyticsView, DashboardOrdersManager, CustomerWhatsAppCell)
 * con encoding CONSISTENTE del número en todas las llamadas.
 */
export function buildVenezuelanWaUrl(rawPhone: string, text: string): string {
  const clean = rawPhone.replace(/\D/g, '');
  const withCc = clean.startsWith('58') ? clean : `58${clean}`;
  return `https://wa.me/${encodeURIComponent(withCc)}?text=${encodeURIComponent(text)}`;
}

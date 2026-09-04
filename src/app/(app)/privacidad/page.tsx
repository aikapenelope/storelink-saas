import type { Metadata } from 'next';

/**
 * Aviso de Privacidad (auditoría 2026-09-04, P1 — privacidad).
 *
 * El checkout recolecta nombre, teléfono, email y dirección de entrega sin
 * ningún aviso ni consentimiento. Esta página declara qué se recolecta, para
 * qué, con qué terceros se comparte (WhatsApp/Meta, Resend, Trello) y qué
 * derechos tiene el cliente. El carrito enlaza aquí con un checkbox
 * obligatorio antes del submit.
 *
 * Marco legal: el tratamiento lo realiza cada COMERCIO (responsable del
 * tratamiento sobre su clientela) a través de la plataforma; StoreLink opera
 * como encargado. Venezuela carece de ley integral de protección de datos
 * (aplica la Ley de Infogobierno para el sector público y normas civiles
 * generales); si el comercio vende a clientes de la UE/EEA/California, son
 * aplicables GDPR/CCPA por alcance territorial — esta página cubre los
 * mínimos comunes (finalidad, terceros, derechos, retención).
 */

export const metadata: Metadata = {
  title: 'Aviso de Privacidad | Flow by Martes',
  description:
    'Cómo se tratan los datos personales que proporcionas al hacer un pedido en las tiendas de Flow by Martes: finalidad, terceros, conservación y derechos.',
  alternates: { canonical: '/privacidad' },
};

const sections: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: '1. Responsable del tratamiento',
    body: (
      <>
        Los datos de tu pedido son tratados por el <strong>comercio</strong> donde realizas la
        compra, que utiliza la plataforma Flow by Martes para gestionar su catálogo, pedidos y
        despacho. Flow by Martes actúa como proveedor técnico de la plataforma.
      </>
    ),
  },
  {
    title: '2. Datos que se recolectan',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>Nombre completo (para identificarte en la entrega).</li>
        <li>Número de teléfono y correo electrónico (confirmación y coordinación del pedido).</li>
        <li>Dirección de entrega: zona, edificio/casa, municipio (para el despacho).</li>
        <li>Detalles de pago que TÚ proporcionas como comprobante: número de referencia, banco
          emisor, identificador de la cuenta emisora. <strong>Nunca</strong> se solicitan ni se
          almacenan claves, PIN ni tarjetas completas.</li>
      </ul>
    ),
  },
  {
    title: '3. Finalidad',
    body: (
      <>
        Gestionar tu pedido: registro, confirmación por WhatsApp y correo, preparación, entrega y
        soporte posventa. Los datos se usan única y exclusivamente para completar la compra que
        iniciaste.
      </>
    ),
  },
  {
    title: '4. Terceros con los que se comparte',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>WhatsApp (Meta)</strong>: el detalle del pedido (nombre, teléfono, dirección,
          productos y monto) se envía por un enlace de WhatsApp al comercio. Ese mensaje viaja por
          la infraestructura de Meta.
        </li>
        <li>
          <strong>Resend</strong>: el correo de confirmación con tu Nota de Entrega (PDF) se envía
          mediante el proveedor de email del comercio.
        </li>
        <li>
          <strong>Trello</strong>: si el comercio lo configura, los datos de despacho (nombre,
          dirección, teléfono) se registran en el tablero logístico del propio comercio.
        </li>
        <li>
          <strong>Cloudflare R2</strong>: tu Nota de Entrega en PDF se almacena cifrada en tránsito
          y solo se accede mediante URL firmada con expiración.
        </li>
      </ul>
    ),
  },
  {
    title: '5. Conservación',
    body: (
      <>
        Los datos del pedido se conservan mientras el comercio los necesite para su gestión
        comercial y contable. La Nota de Entrega en PDF contiene tus datos; el enlace de descarga
        caduca en 7 días como máximo. Puedes solicitar la eliminación en cualquier momento.
      </>
    ),
  },
  {
    title: '6. Tus derechos',
    body: (
      <>
        Puedes solicitar al comercio el <strong>acceso, rectificación o eliminación</strong> de tus
        datos, oponerte a su tratamiento o pedir una copia, contactando directamente a la tienda por
        sus canales de atención (WhatsApp o correo de contacto). Si consideras que tus derechos no
        fueron respetados, puedes reclamar ante el comercio y ante la autoridad de protección de
        datos de tu jurisdicción.
      </>
    ),
  },
  {
    title: '7. Cookies y almacenamiento local',
    body: (
      <>
        El catálogo usa almacenamiento local del navegador únicamente para recordar tu carrito
        (uso técnico, sin seguimiento). No usamos cookies publicitarias ni analítica de terceros.
      </>
    ),
  },
];

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-black tracking-tight mb-2">Aviso de Privacidad</h1>
        <p className="text-xs text-slate-500 font-mono mb-10">
          Última actualización: septiembre 2026 · Aplica a pedidos realizados en tiendas creadas con
          Flow by Martes
        </p>
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 mb-2">
                {section.title}
              </h2>
              <div className="text-sm text-slate-700 leading-relaxed space-y-2">{section.body}</div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

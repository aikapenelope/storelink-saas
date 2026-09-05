import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Plus_Jakarta_Sans, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  // Auditoría 2026-09-04 (P2 SEO): sin metadataBase, las URLs de OG/canonical
  // relativas se resuelven mal en el HTML final.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://flow.martes.app'),
  title: 'Flow by Martes — Tu negocio vendiendo 24/7 en piloto automático | 0% Comisiones',
  description:
    'Flow by Martes — Tu negocio vendiendo 24/7 en piloto automático con agentes de IA oficiales, catálogo interactivo y e-commerce de estándar internacional. 0% comisiones.',
  // Sin manifest: esta es una web responsive (mobile + desktop), no una PWA
  // instalable. Se eliminó app/manifest.ts a propósito — Next.js App Router
  // solo genera /manifest.webmanifest y el <link rel="manifest"> cuando ese
  // archivo existe (docs oficiales Next.js file-conventions/manifest); sin
  // él, ningún navegador ofrece "Instalar app".
};

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
  // Auditoría 2026-09-04 (a11y): se eliminan maximumScale/userScalable:false —
  // bloquear el zoom falla WCAG 1.4.4 (Resize Text) y penaliza en Lighthouse.
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="scroll-smooth">
      <body className={`${plusJakartaSans.className} ${spaceGrotesk.variable} ${jetBrainsMono.variable} antialiased min-h-screen bg-[#0c0418] text-slate-950 selection:bg-violet-500 selection:text-white`}>
        {children}
        <Script
          src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}

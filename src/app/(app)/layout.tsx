import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Flow | Catálogos PWA e E-Commerce para WhatsApp',
  description: 'Plataforma multi-tenant de catálogos y e-commerce conectados directamente con WhatsApp y Trello.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased min-h-screen selection:bg-green-100 selection:text-green-800">
        {children}
      </body>
    </html>
  );
}

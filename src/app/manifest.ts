import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StoreLink PWA Store',
    short_name: 'StoreLink',
    description: 'Catálogo de productos y pedidos directos por WhatsApp',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#16a34a',
    // TODO: agregar icon-192.png e icon-512.png en public/ para que la PWA
    // sea instalable (Chrome exige ≥192px). Por ahora se usa dashboard.png
    // como placeholder hasta que se diseñen los iconos definitivos.
    icons: [
      {
        src: '/dashboard.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  };
}

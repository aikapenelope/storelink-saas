import type { CollectionConfig } from 'payload';
import { hasTenantAccess } from '@/lib/utils';
import { createTenantWriteGuard } from '@/hooks/ensureTenantMembership';

export const Media: CollectionConfig = {
  slug: 'media',
  hooks: {
    // Guard A1: rechaza create/update con tenant ajeno (403) antes de validar
    beforeChange: [createTenantWriteGuard()],
  },
  upload: {
    staticDir: 'media',
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
        height: 300,
        position: 'centre',
      },
      {
        name: 'card',
        width: 600,
        height: 600,
        position: 'centre',
      },
    ],
    adminThumbnail: 'thumbnail',
    mimeTypes: ['image/*'],
    // Sprint 4: crop:true habilita el recorte manual en el panel admin
    // sin cambios en el schema de BD (solo UI). Patrón oficial COLLECTIONS.md.
    // Sprint 5: focalPoint:true habilita el selector de punto focal en el admin.
    // Sin cambios de BD: Payload añade focalX/focalY al schema SIEMPRE que
    // imageSizes esté definido (ver getBaseFields.js, Payload 3.88). Las columnas
    // `focal_x` y `focal_y` ya existen en la tabla media desde el schema inicial.
    // Cambio solo de UI — no requiere migración.
    crop: true,
    focalPoint: true,
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => hasTenantAccess(user),
    update: ({ req: { user } }) => hasTenantAccess(user),
    delete: ({ req: { user } }) => hasTenantAccess(user),
  },
  fields: [
    {
      // Sprint 4: required:true fuerza a los comerciantes a incluir texto
      // alternativo al subir imágenes de productos — accesibilidad y SEO.
      // Patrón oficial COLLECTIONS.md §Upload Collection.
      name: 'alt',
      type: 'text',
      required: true,
      label: 'Texto Alternativo (Alt)',
      admin: {
        description: 'Descripción breve de la imagen para accesibilidad y SEO. Ej: "Pizza margherita con albahaca fresca"',
      },
    },
  ],
};

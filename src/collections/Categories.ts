import type { CollectionConfig } from 'payload';
import { hasTenantAccess } from '@/lib/utils';
import { createTenantWriteGuard } from '@/hooks/ensureTenantMembership';

export const Categories: CollectionConfig = {
  slug: 'categories',
  hooks: {
    // Guard A1: rechaza create/update con tenant ajeno (403) antes de validar
    beforeChange: [createTenantWriteGuard()],
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'tenant'],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => hasTenantAccess(user),
    update: ({ req: { user } }) => hasTenantAccess(user),
    delete: ({ req: { user } }) => hasTenantAccess(user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Nombre de la Categoría (ej: Pizzas, Bebidas, Ropa)',
    },
    {
      // Sprint 2: NO se migra a type:'slug' porque la unicidad es compuesta
      // (tenant_id, slug) — migración 20260827_email_idempotency_and_category_slug_unique.
      // El tipo nativo slug agregaría un UNIQUE global que rompería tenants con
      // la misma categoría (ej. dos tiendas con "Bebidas"). Se añade index:true
      // para que el schema de Payload refleje el índice compuesto existente en BD.
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      label: 'Identificador (slug)',
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      label: 'Orden de visualización',
    },
  ],
};

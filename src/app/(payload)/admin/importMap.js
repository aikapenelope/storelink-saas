import { TenantSelectionProvider, TenantSelector } from '@payloadcms/plugin-multi-tenant/rsc';
import { MerchantDashboard } from '@/components/admin/MerchantDashboard';

export const importMap = {
  '@payloadcms/plugin-multi-tenant/rsc#TenantSelectionProvider': TenantSelectionProvider,
  '@payloadcms/plugin-multi-tenant/rsc#TenantSelector': TenantSelector,
  '@/components/admin/MerchantDashboard#MerchantDashboard': MerchantDashboard,
};


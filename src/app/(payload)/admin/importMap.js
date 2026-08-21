import { TenantSelectionProvider, TenantSelector } from '@payloadcms/plugin-multi-tenant/rsc';
import { StoreUrlBanner } from '@/components/admin/StoreUrlBanner';
import { MerchantDashboard } from '@/components/admin/MerchantDashboard';
import { AnalyticsView } from '@/components/admin/AnalyticsView';
import { DiscreetSheetsSync } from '@/components/admin/DiscreetSheetsSync';
import { S3ClientUploadHandler } from '@payloadcms/storage-s3/client';

export const importMap = {
  '@payloadcms/plugin-multi-tenant/rsc#TenantSelectionProvider': TenantSelectionProvider,
  '@payloadcms/plugin-multi-tenant/rsc#TenantSelector': TenantSelector,
  '@/components/admin/StoreUrlBanner#StoreUrlBanner': StoreUrlBanner,
  '@/components/admin/MerchantDashboard#MerchantDashboard': MerchantDashboard,
  '@/components/admin/AnalyticsView#AnalyticsView': AnalyticsView,
  '@/components/admin/DiscreetSheetsSync#DiscreetSheetsSync': DiscreetSheetsSync,
  '@payloadcms/storage-s3/client#S3ClientUploadHandler': S3ClientUploadHandler,
};



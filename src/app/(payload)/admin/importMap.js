import { TenantSelectionProvider, TenantSelector } from '@payloadcms/plugin-multi-tenant/rsc';
import { MerchantDashboard } from '@/components/admin/MerchantDashboard';
import { AnalyticsView } from '@/components/admin/AnalyticsView';
import { S3ClientUploadHandler } from '@payloadcms/storage-s3/client';

export const importMap = {
  '@payloadcms/plugin-multi-tenant/rsc#TenantSelectionProvider': TenantSelectionProvider,
  '@payloadcms/plugin-multi-tenant/rsc#TenantSelector': TenantSelector,
  '@/components/admin/MerchantDashboard#MerchantDashboard': MerchantDashboard,
  '@/components/admin/AnalyticsView#AnalyticsView': AnalyticsView,
  '@payloadcms/storage-s3/client#S3ClientUploadHandler': S3ClientUploadHandler,
};



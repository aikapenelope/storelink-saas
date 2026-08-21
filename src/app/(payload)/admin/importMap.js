import { TenantSelectionProvider, TenantSelector } from '@payloadcms/plugin-multi-tenant/rsc';
import { CollectionCards, DocumentHeader, Logo, DefaultNav, FolderField, FolderTableCell } from '@payloadcms/next/rsc';
import { StoreUrlBanner } from '@/components/admin/StoreUrlBanner';
import { AnalyticsView } from '@/components/admin/AnalyticsView';
import { S3ClientUploadHandler } from '@payloadcms/storage-s3/client';

export const importMap = {
  '@payloadcms/plugin-multi-tenant/rsc#TenantSelectionProvider': TenantSelectionProvider,
  '@payloadcms/plugin-multi-tenant/rsc#TenantSelector': TenantSelector,
  '@payloadcms/next/rsc#CollectionCards': CollectionCards,
  '@payloadcms/next/rsc#DocumentHeader': DocumentHeader,
  '@payloadcms/next/rsc#Logo': Logo,
  '@payloadcms/next/rsc#DefaultNav': DefaultNav,
  '@payloadcms/next/rsc#FolderField': FolderField,
  '@payloadcms/next/rsc#FolderTableCell': FolderTableCell,
  '@/components/admin/StoreUrlBanner#StoreUrlBanner': StoreUrlBanner,
  '@/components/admin/AnalyticsView#AnalyticsView': AnalyticsView,
  '@payloadcms/storage-s3/client#S3ClientUploadHandler': S3ClientUploadHandler,
};

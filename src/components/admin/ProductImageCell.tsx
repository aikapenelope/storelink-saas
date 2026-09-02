'use client';

import React from 'react';
import Image from 'next/image';
import { Image as ImageIcon } from 'lucide-react';

// Payload envía cellData como string[] para campos text con hasMany: true.
// El fallback a rowData.images (upload legacy) se mantiene para productos
// existentes que aún no hayan sido migrados a imageUrls (Fase 1 expand).
interface ProductImageCellProps {
  cellData?: string[] | null;
  rowData?: {
    imageUrls?: string[] | null;
    images?: Array<{ image?: { url?: string } | null }>;
    title?: string;
  };
}

export function ProductImageCell({ cellData, rowData }: ProductImageCellProps) {
  const [hasError, setHasError] = React.useState(false);
  const imageUrl =
    cellData?.[0] ??
    rowData?.imageUrls?.[0] ??
    (Array.isArray(rowData?.images) && rowData.images[0]?.image?.url) ??
    null;

  if (!imageUrl || hasError) {
    return (
      <div className="w-9 h-9 bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 rounded-none shrink-0">
        <ImageIcon className="w-4 h-4" />
      </div>
    );
  }

  const count =
    (Array.isArray(cellData) && cellData.filter(Boolean).length) ||
    (Array.isArray(rowData?.imageUrls) && rowData.imageUrls.filter(Boolean).length) ||
    (Array.isArray(rowData?.images) && rowData.images.length) ||
    1;

  return (
    <div className="w-9 h-9 bg-zinc-950 border border-zinc-700 overflow-hidden rounded-none shrink-0 relative flex items-center justify-center">
      <Image
        src={imageUrl}
        alt={rowData?.title || 'Producto'}
        fill
        sizes="36px"
        className="object-cover rounded-none"
        onError={() => setHasError(true)}
      />
      {count > 1 && (
        <div
          className="absolute bottom-0 right-0 bg-black/85 text-emerald-400 text-[9px] font-mono font-bold px-1 rounded-tl shadow-xs select-none"
          title={`${count} fotos disponibles`}
        >
          +{count - 1}
        </div>
      )}
    </div>
  );
}

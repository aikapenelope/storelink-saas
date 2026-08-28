'use client';

import React from 'react';
import Image from 'next/image';
import { Image as ImageIcon } from 'lucide-react';

interface ProductImageCellProps {
  cellData?: string | null;
  rowData?: {
    imageUrl?: string | null;
    images?: Array<{ image?: { url?: string } | null }>;
    title?: string;
  };
}

export function ProductImageCell({ cellData, rowData }: ProductImageCellProps) {
  const imageUrl = cellData || rowData?.imageUrl || (Array.isArray(rowData?.images) && rowData.images[0]?.image?.url) || null;

  if (!imageUrl) {
    return (
      <div className="w-9 h-9 bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 rounded-none shrink-0">
        <ImageIcon className="w-4 h-4" />
      </div>
    );
  }

  return (
    <div className="w-9 h-9 bg-zinc-950 border border-zinc-700 overflow-hidden rounded-none shrink-0 relative flex items-center justify-center">
      <Image
        src={imageUrl}
        alt={rowData?.title || 'Producto'}
        fill
        sizes="36px"
        className="object-cover rounded-none"
      />
    </div>
  );
}

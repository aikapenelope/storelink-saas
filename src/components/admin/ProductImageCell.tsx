'use client';

import React from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface ProductImageCellProps {
  cellData?: string | null;
  rowData?: any;
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
      <img
        src={imageUrl}
        alt={rowData?.title || 'Producto'}
        className="w-full h-full object-cover rounded-none"
        loading="lazy"
      />
    </div>
  );
}

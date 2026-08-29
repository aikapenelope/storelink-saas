'use client';

import React, { useState, useEffect } from 'react';
import Image, { type ImageProps } from 'next/image';
import { DEFAULT_PRODUCT_IMAGE_URL } from '@/lib/constants';

export interface SafeProductImageProps extends Omit<ImageProps, 'src'> {
  src?: string | null;
  fallbackSrc?: string;
}

export function SafeProductImage({
  src,
  fallbackSrc = DEFAULT_PRODUCT_IMAGE_URL,
  alt,
  ...props
}: SafeProductImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string>(src || fallbackSrc);

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc);
  }, [src, fallbackSrc]);

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt || 'Producto'}
      onError={() => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import Image, { type ImageProps } from 'next/image';
import { DEFAULT_PRODUCT_IMAGE_URL } from '@/lib/constants';

export interface SafeProductImageProps extends Omit<ImageProps, 'src'> {
  src?: string | null;
  fallbackSrc?: string;
}

/**
 * Componente de imagen resiliente para productos.
 * Si la URL provista devuelve error (404, DNS, timeout o link caído),
 * conmuta automáticamente a la imagen de fallback sin romper la UI.
 */
export function SafeProductImage({
  src,
  fallbackSrc = DEFAULT_PRODUCT_IMAGE_URL,
  alt,
  onError,
  ...props
}: SafeProductImageProps) {
  const initialSrc = typeof src === 'string' && src.trim().length > 0 ? src.trim() : fallbackSrc;
  const [currentSrc, setCurrentSrc] = useState<string>(initialSrc);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    const validSrc = typeof src === 'string' && src.trim().length > 0 ? src.trim() : fallbackSrc;
    setCurrentSrc(validSrc);
    setHasError(false);
  }, [src, fallbackSrc]);

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt || 'Producto'}
      onError={(e) => {
        if (!hasError && currentSrc !== fallbackSrc) {
          setHasError(true);
          setCurrentSrc(fallbackSrc);
        }
        if (onError) {
          onError(e);
        }
      }}
    />
  );
}

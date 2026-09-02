'use client';

import React, { useState, useEffect } from 'react';
import Image, { type ImageProps } from 'next/image';
import { DEFAULT_PRODUCT_IMAGE_URL } from '@/lib/constants';
import { isAllowedImageUrl } from '@/lib/image-hosts';

export interface SafeProductImageProps extends Omit<ImageProps, 'src'> {
  src?: string | null;
  fallbackSrc?: string;
}

/**
 * Componente de imagen resiliente para productos.
 * Si la URL provista devuelve error (404, DNS, timeout o link caído),
 * conmuta automáticamente a la imagen de fallback sin romper la UI.
 *
 * Defensa en profundidad (auditoría final 2026-09-01, CRÍTICO): next/image
 * LANZA en render si el host no está en images.remotePatterns — ese throw NO
 * lo captura onError y tumbaba el árbol React entero (500 en SSR). Aunque la
 * whitelist ya se valida al guardar (Products.ts) y al importar (catalog-
 * import.ts), un producto histórico o un bug podrían traer un host no listado:
 * en ese caso se renderiza con <img> nativo (que sí tiene onError real) en
 * lugar de next/image, degradando a "imagen rota → fallback" en vez de crash.
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

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError && currentSrc !== fallbackSrc) {
      setHasError(true);
      setCurrentSrc(fallbackSrc);
    }
    if (onError) {
      onError(e as never);
    }
  };

  // Host fuera de la whitelist → <img> nativo: el throw de render de
  // next/image es imposible de atrapar; con <img> el fallback funciona.
  // Fix review Devin (P0 #63): preservar el contrato de layout — con `fill`
  // replicamos el posicionamiento absoluto que next/image aplicaría, para que
  // la imagen no se desborde del contenedor `relative` de temas y modal.
  if (!isAllowedImageUrl(currentSrc)) {
    const { fill, ...restProps } = props;
    const fillStyle: React.CSSProperties | undefined = fill
      ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...((props.style as React.CSSProperties) ?? {}) }
      : (props.style as React.CSSProperties | undefined);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={currentSrc}
        alt={alt || 'Producto'}
        onError={handleError}
        className={restProps.className}
        style={fillStyle}
        loading={restProps.loading ?? 'lazy'}
        {...(restProps.width != null ? { width: restProps.width } : {})}
        {...(restProps.height != null ? { height: restProps.height } : {})}
      />
    );
  }

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt || 'Producto'}
      onError={handleError}
    />
  );
}

/**
 * Contrato de "resultado en proceso" del checkout (review Devin #74:
 * "Slow retries create duplicate orders").
 *
 * Cuando un request duplicado espera la respuesta del dueño y se agota la
 * ventana de espera (2.5s), el dueño PUEDE seguir procesando (PDF + upload a
 * R2, persistencia, CRM, Trello/email). Eso NO es un fallo definitivo: es un
 * resultado EN PROCESO. El cliente debe distinguirlo de un error real para
 * PRESERVAR el token de intención — así el reintento del usuario recae en la
 * MISMA clave de idempotencia y se adhiere a la reserva existente en vez de
 * crear una segunda orden.
 *
 * Módulo isomórfico: sin dependencias de Node, importable desde el Server
 * Action y desde el carrito (client component).
 */

/** Respuesta estructurada de "otro request idéntico sigue en proceso". */
export interface CheckoutProcessingResponse {
  success: false;
  error: string;
  processing: true;
}

export function buildCheckoutProcessingResponse(): CheckoutProcessingResponse {
  return {
    success: false,
    processing: true,
    error:
      'Tu pedido anterior idéntico todavía se está procesando. Espera unos segundos y revisa tu WhatsApp antes de volver a enviar.',
  };
}

/**
 * Type guard usado por el carrito: si la respuesta es "en proceso", el token
 * de intención se PRESERVA (el reintento se adhiere a la reserva existente).
 * Cualquier otra respuesta (éxito o fallo definitivo antes de crear la orden)
 * sí permite limpiar el token.
 */
export function isCheckoutProcessingResponse(
  value: unknown
): value is CheckoutProcessingResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { processing?: unknown }).processing === true
  );
}
/**
 * Sanitización de campos de pago del comprador (Auditoría 2026-09-07, hallazgo A1).
 *
 * El comprador anónimo es un writer NO confiable: el estado de verificación del
 * pago lo decide SIEMPRE el servidor. La normalización vive en el boundary de
 * la Server Action de checkout (y NO en hooks de colección) porque el admin
 * panel usa la misma colección y ahí el comercio SÍ puede marcar `verified`
 * legítimamente al conciliar el pago.
 *
 * Patrón oficial: "Never trust client-provided data" + whitelist de claves.
 */

export type CheckoutPaymentMethodKey =
  | 'pago_movil'
  | 'zelle'
  | 'binance'
  | 'zinli'
  | 'banesco_panama'
  | 'cash'
  | 'pos';

/** Cota de longitud por campo (backlog P3 "cotas de longitud"): evita strings de MB. */
const MAX_FIELD_LENGTH = 200;

const METHOD_KEYS: readonly CheckoutPaymentMethodKey[] = [
  'pago_movil',
  'zelle',
  'binance',
  'zinli',
  'banesco_panama',
  'cash',
  'pos',
];

const STRING_FIELDS = [
  'referenceNumber',
  'issuingBank',
  'issuingPhone',
  'senderName',
  'senderEmail',
  'binanceSenderId',
] as const;

export interface NormalizedPaymentDetails {
  methodKey?: CheckoutPaymentMethodKey;
  referenceNumber?: string;
  issuingBank?: string;
  issuingPhone?: string;
  senderName?: string;
  senderEmail?: string;
  binanceSenderId?: string;
  /** SIEMPRE pending_verification aquí: el cliente jamás define este estado. */
  paymentStatus: 'pending_verification';
}

/**
 * Whitelist de claves + force de paymentStatus. Cualquier clave desconocida del
 * cliente se descarta; campos de texto se recortan a MAX_FIELD_LENGTH.
 * Devuelve undefined si la entrada no es un objeto plano (el checkout la trata
 * como ausencia de detalles de pago).
 */
export function normalizePaymentDetails(raw: unknown): NormalizedPaymentDetails | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }

  const input = raw as Record<string, unknown>;
  const normalized: NormalizedPaymentDetails = { paymentStatus: 'pending_verification' };

  const methodKey = METHOD_KEYS.find((key) => key === input.methodKey);
  if (methodKey) {
    normalized.methodKey = methodKey;
  }

  for (const field of STRING_FIELDS) {
    const value = input[field];
    if (typeof value === 'string' && value.trim()) {
      normalized[field] = value.trim().slice(0, MAX_FIELD_LENGTH);
    }
  }

  return normalized;
}

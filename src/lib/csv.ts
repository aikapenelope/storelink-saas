/**
 * Utilidades de ingesta CSV compartidas entre import-csv y sync-sheets.
 *
 * parseCSVLine: parser mínimo con soporte de comillas RFC 4180.
 * sanitizeCsvCell / validateCsvLimits: hardening contra DoS e inyección.
 *
 * Dos vectores cubiertos:
 * 1. DoS por payload gigante: límite de bytes y de filas antes de parsear.
 * 2. Inyección de fórmulas (guía OWASP "CSV Injection"): una celda que
 *    empieza por = + - @ o tab/CR se ejecuta como fórmula al abrir en Excel
 *    o Google Sheets cualquier export posterior (panel de pedidos → Sheets).
 *    Se neutraliza con prefijo apóstrofe, el estándar del sector.
 *
 * Funciones puras sin dependencias de Next/Payload: testeables de forma
 * determinista (mismo patrón que checkout-guard.ts).
 */

/**
 * Parsea una línea CSV con soporte de comillas RFC 4180.
 * Movido aquí desde import-csv/route.ts y sync-sheets/route.ts (estaban
 * duplicadas 1:1; se centraliza para mantenerlas sincronizadas).
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
  return result;
}

/** Máximo tamaño del CSV crudo en bytes (2 MB ≈ decenas de miles de filas cortas). */
export const MAX_CSV_BYTES = 2 * 1024 * 1024;

/** Máximo de filas de datos (sin contar el encabezado). */
export const MAX_CSV_ROWS = 5000;

/** Solo prefijos que sobreviven al trim(): un tab/CR inicial desaparece con
 *  el propio recorte y por tanto no puede llegar a ser fórmula. */
const FORMULA_PREFIXES = ['=', '+', '-', '@'];

/** Neutraliza celdas que Excel/Sheets interpretarían como fórmula. */
export function sanitizeCsvCell(value: string | undefined | null): string {
  if (typeof value !== 'string') return '';
  const cell = value.trim();
  if (cell.length === 0) return '';
  if (FORMULA_PREFIXES.some((prefix) => cell.startsWith(prefix))) {
    return `'${cell}`;
  }
  return cell;
}

export type CsvLimitCheck = { ok: true } | { ok: false; error: string };

/**
 * Valida límites del documento completo. `rowCount` es opcional: si el caller
 * ya partió las líneas se lo pasa para no re-partir; si no, se computa aquí.
 */
export function validateCsvLimits(raw: string, rowCount?: number): CsvLimitCheck {
  if (Buffer.byteLength(raw, 'utf8') > MAX_CSV_BYTES) {
    return { ok: false, error: 'El archivo excede el límite de 2 MB.' };
  }
  const rows =
    rowCount ?? Math.max(0, raw.split(/\r?\n/).filter((line) => line.trim().length > 0).length - 1);
  if (rows > MAX_CSV_ROWS) {
    return { ok: false, error: `El archivo excede el máximo de ${MAX_CSV_ROWS} filas de datos.` };
  }
  return { ok: true };
}

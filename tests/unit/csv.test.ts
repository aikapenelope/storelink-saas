import { describe, expect, it } from 'vitest';
import {
  MAX_CELL_LENGTH,
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  detectCsvDelimiter,
  parseCSVLine,
  parseCSVRecords,
  sanitizeCsvCell,
  validateCsvLimits,
} from '../../src/lib/csv';

describe('sanitizeCsvCell — inyección de fórmulas (OWASP)', () => {
  it('prefija apóstrofe a celdas que empiezan con =', () => {
    expect(sanitizeCsvCell('=HYPERLINK("http://evil","gana")')).toBe(
      '\'=HYPERLINK("http://evil","gana")'
    );
  });

  it('prefija apóstrofe a +, - y @', () => {
    expect(sanitizeCsvCell('+1 555')).toBe("'+1 555");
    expect(sanitizeCsvCell('-50% OFF')).toBe("'-50% OFF");
    expect(sanitizeCsvCell('@cmd')).toBe("'@cmd");
  });

  it('un tab inicial se elimina con el trim: no puede convertirse en fórmula', () => {
    expect(sanitizeCsvCell('\tSUM(A1)')).toBe('SUM(A1)');
  });

  it('no altera celdas inocuas y recorta espacios', () => {
    expect(sanitizeCsvCell('Pizza Familiar')).toBe('Pizza Familiar');
    expect(sanitizeCsvCell('  Talla L ')).toBe('Talla L');
    expect(sanitizeCsvCell('PIZ-001')).toBe('PIZ-001');
  });

  it('normaliza vacíos: null, undefined y solo-espacios devuelven ""', () => {
    expect(sanitizeCsvCell(null)).toBe('');
    expect(sanitizeCsvCell(undefined)).toBe('');
    expect(sanitizeCsvCell('   ')).toBe('');
    expect(sanitizeCsvCell('')).toBe('');
  });

  it('trunca celdas que exceden MAX_CELL_LENGTH para evitar memory bloat', () => {
    const longText = 'A'.repeat(MAX_CELL_LENGTH + 500);
    const sanitized = sanitizeCsvCell(longText);
    expect(sanitized.length).toBe(MAX_CELL_LENGTH);
    expect(sanitized).toBe('A'.repeat(MAX_CELL_LENGTH));
  });

  it('trunca celdas con fórmulas y mantiene prefijo apóstrofe', () => {
    const longFormula = '=' + 'B'.repeat(MAX_CELL_LENGTH + 100);
    const sanitized = sanitizeCsvCell(longFormula);
    expect(sanitized.startsWith("'=")).toBe(true);
    // '=' + 'B' * (MAX_CELL_LENGTH - 1) prefixado por "'" = MAX_CELL_LENGTH + 1
    expect(sanitized.length).toBe(MAX_CELL_LENGTH + 1);
  });
});

describe('validateCsvLimits — DoS por payload gigante', () => {
  it('acepta un CSV dentro de límites', () => {
    const csv = 'sku,title,price\nA-1,Pizza,10\nB-2,Pasta,12';
    expect(validateCsvLimits(csv)).toEqual({ ok: true });
  });

  it('rechaza CSV mayor a MAX_CSV_BYTES', () => {
    const big = 'x'.repeat(MAX_CSV_BYTES + 1);
    const result = validateCsvLimits(big);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('2 MB');
  });

  it('rechaza más filas de datos que MAX_CSV_ROWS', () => {
    const header = 'sku,title,price';
    const rows = Array.from({ length: MAX_CSV_ROWS + 1 }, (_, i) => `S-${i},P-${i},${i}`).join('\n');
    const result = validateCsvLimits(`${header}\n${rows}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(String(MAX_CSV_ROWS));
  });

  it('usa rowCount del caller si se provee (evita re-partir líneas)', () => {
    const result = validateCsvLimits('sku,title\nA,B', MAX_CSV_ROWS + 5);
    expect(result.ok).toBe(false);
  });
});

describe('parseCSVLine — RFC 4180 parsing con comillas y delimitadores', () => {
  it('respeta comas dentro de campos entrecomillados', () => {
    const line = '"Pérez, Ana",04141234567,ana@example.com,"Prefiere rojo, azul"';
    const parsed = parseCSVLine(line);
    expect(parsed).toEqual(['Pérez, Ana', '04141234567', 'ana@example.com', 'Prefiere rojo, azul']);
  });

  it('soporta comillas dobles escapadas ("")', () => {
    const line = '"Carlos ""El Tigre"" Pérez",04149998877';
    const parsed = parseCSVLine(line);
    expect(parsed).toEqual(['Carlos "El Tigre" Pérez', '04149998877']);
  });

  it('soporta punto y coma como delimitador alternativo', () => {
    const line = '"Pérez, Ana";04141234567;ana@example.com;"Nota con ; punto y coma"';
    const parsed = parseCSVLine(line, ';');
    expect(parsed).toEqual(['Pérez, Ana', '04141234567', 'ana@example.com', 'Nota con ; punto y coma']);
  });

  it('soporta tabulador como delimitador', () => {
    const line = 'Carlos Pérez\t04141234567\tcarlos@email.com';
    const parsed = parseCSVLine(line, '\t');
    expect(parsed).toEqual(['Carlos Pérez', '04141234567', 'carlos@email.com']);
  });
});

describe('detectCsvDelimiter — detección automática de separador', () => {
  it('detecta comas por defecto cuando no hay otros separadores', () => {
    expect(detectCsvDelimiter('Nombre,Telefono,Email')).toBe(',');
  });

  it('detecta punto y coma cuando es el separador predominante', () => {
    expect(detectCsvDelimiter('"Pérez, Ana";04141234567;ana@example.com;Nota')).toBe(';');
  });

  it('detecta tabulador cuando es el separador predominante', () => {
    expect(detectCsvDelimiter('Carlos Pérez\t04141234567\tcarlos@email.com')).toBe('\t');
  });

  it('no confunde comas dentro de comillas con el delimitador principal', () => {
    const line = '"Pérez, Ana";04141234567;"Caracas, Venezuela"';
    expect(detectCsvDelimiter(line)).toBe(';');
  });
});

describe('parseCSVRecords — RFC 4180 parsing multilínea con saltos dentro de comillas', () => {
  it('preserva saltos de línea dentro de notas entrecomilladas sin partir registros', () => {
    const csv = [
      'Nombre,Telefono,Email,Notas',
      '"Carlos Pérez",04141234567,carlos@email.com,"Entrega posterior\nMaría, 04141234567"',
      '"Juan Gómez",04249876543,juan@email.com,"Sin notas"',
    ].join('\n');

    const records = parseCSVRecords(csv);
    expect(records.length).toBe(3);
    expect(records[0]).toEqual(['Nombre', 'Telefono', 'Email', 'Notas']);
    expect(records[1]).toEqual([
      'Carlos Pérez',
      '04141234567',
      'carlos@email.com',
      'Entrega posterior\nMaría, 04141234567',
    ]);
    expect(records[2]).toEqual(['Juan Gómez', '04249876543', 'juan@email.com', 'Sin notas']);
  });

  it('soporta retornos de carro CRLF y comillas dobles escapadas multilínea', () => {
    const csv = '"Ana Silva"\t04121112233\t"Nota con ""comillas""\r\ny segunda línea"\r\n"Pedro"\t04169998877\t"OK"';
    const records = parseCSVRecords(csv, '\t');
    expect(records.length).toBe(2);
    expect(records[0][0]).toBe('Ana Silva');
    expect(records[0][2]).toBe('Nota con "comillas"\r\ny segunda línea');
    expect(records[1][0]).toBe('Pedro');
    expect(records[1][2]).toBe('OK');
  });

  it('devuelve array vacío para entradas vacías', () => {
    expect(parseCSVRecords('')).toEqual([]);
    expect(parseCSVRecords('   \n\n  ')).toEqual([]);
  });
});



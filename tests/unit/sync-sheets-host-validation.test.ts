import { describe, it, expect } from 'vitest';

describe('Google Sheets SSRF redirect host validation', () => {
  function isLegitimateGoogleSheetsHost(finalHost: string): boolean {
    return (
      finalHost === 'docs.google.com' ||
      /[.-]sheets\.googleusercontent\.com$/.test(finalHost) ||
      finalHost.endsWith('.googleusercontent.com')
    );
  }

  it('permite el host estándar docs.google.com', () => {
    expect(isLegitimateGoogleSheetsHost('docs.google.com')).toBe(true);
  });

  it('permite los hosts CDN de exportación de Google Sheets (doc-XX-YY-sheets.googleusercontent.com)', () => {
    expect(isLegitimateGoogleSheetsHost('doc-08-4o-sheets.googleusercontent.com')).toBe(true);
    expect(isLegitimateGoogleSheetsHost('doc-0k-10-sheets.googleusercontent.com')).toBe(true);
    expect(isLegitimateGoogleSheetsHost('export.sheets.googleusercontent.com')).toBe(true);
  });

  it('bloquea hosts de redirección no autorizados (SSRF)', () => {
    expect(isLegitimateGoogleSheetsHost('evil.com')).toBe(false);
    expect(isLegitimateGoogleSheetsHost('attacker.sheets.googleusercontent.com.evil.com')).toBe(false);
    expect(isLegitimateGoogleSheetsHost('notgoogleusercontent.com')).toBe(false);
    expect(isLegitimateGoogleSheetsHost('drive.google.com.evil.com')).toBe(false);
    expect(isLegitimateGoogleSheetsHost('localhost')).toBe(false);
    expect(isLegitimateGoogleSheetsHost('169.254.169.254')).toBe(false);
  });
});

import {
  normalizeBarcode,
  isBlankBarcode,
  generateInternalBarcode,
} from './barcode';

describe('normalizeBarcode', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeBarcode('  2001  ')).toBe('2001');
  });

  it('strips trailing CR/LF a scanner appends', () => {
    expect(normalizeBarcode('2001\r\n')).toBe('2001');
    expect(normalizeBarcode('2001\t')).toBe('2001');
  });

  it('uppercases alphanumeric codes for case-insensitive match', () => {
    expect(normalizeBarcode('art0a1b')).toBe('ART0A1B');
  });

  it('collapses inner whitespace', () => {
    expect(normalizeBarcode('20 01')).toBe('20 01');
    expect(normalizeBarcode('20   01')).toBe('20 01');
  });

  it('drops zero-width and BOM characters', () => {
    expect(normalizeBarcode('20​01﻿')).toBe('2001');
  });

  it('PRESERVES leading zeros (EAN/UPC identity)', () => {
    expect(normalizeBarcode('0049000')).toBe('0049000');
  });

  it('handles null/undefined/empty', () => {
    expect(normalizeBarcode(null)).toBe('');
    expect(normalizeBarcode(undefined)).toBe('');
    expect(normalizeBarcode('   ')).toBe('');
  });

  it('is idempotent', () => {
    const once = normalizeBarcode('  abc 123 \n');
    expect(normalizeBarcode(once)).toBe(once);
  });
});

describe('isBlankBarcode', () => {
  it('treats whitespace-only / control-only as blank', () => {
    expect(isBlankBarcode('  \r\n')).toBe(true);
    expect(isBlankBarcode('')).toBe(true);
    expect(isBlankBarcode(null)).toBe(true);
  });
  it('is false for a real code', () => {
    expect(isBlankBarcode(' 2001 ')).toBe(false);
  });
});

describe('generateInternalBarcode', () => {
  it('builds a stable ART-prefixed code from a uuid', () => {
    const id = '3f9a1b2c-dead-beef-0000-000000000000';
    expect(generateInternalBarcode(id)).toBe('ART3F9A1B2CDE');
  });
  it('pads short ids', () => {
    expect(generateInternalBarcode('a1')).toBe('ART00000000A1');
  });
  it('is deterministic for the same id', () => {
    const id = '11112222-3333-4444-5555-666677778888';
    expect(generateInternalBarcode(id)).toBe(generateInternalBarcode(id));
  });
});

import { describe, expect, test } from 'bun:test';
import {
  expectedPartSize,
  FILE_MAX_BYTES,
  FILE_PART_BYTES,
  isValidFileName,
  isValidFileSize,
  normalizeContentType,
  partCountOf,
} from './file-limits.ts';
import { formatFileSize } from './format-file-size.ts';

describe('file limits (secret-files AC-1.3, AC-1.4, AC-1.5)', () => {
  test('a file holds 1 byte to 100 MiB, in whole bytes', () => {
    expect(FILE_MAX_BYTES).toBe(104_857_600);
    expect([1, 1024, FILE_MAX_BYTES].every(isValidFileSize)).toBe(true);
    expect([0, -1, FILE_MAX_BYTES + 1, 2.5, Number.NaN].some(isValidFileSize)).toBe(false);
  });

  test('names are 1–255 bytes without path separators or control characters', () => {
    expect(['report.pdf', 'résumé 2026.docx', 'a'.repeat(255), '.env'].every(isValidFileName)).toBe(true);
    expect(['', 'a'.repeat(256), 'é'.repeat(128), 'dir/file', 'dir\\file', 'bad\nname', 'nul\u0000', '.', '..'].some(isValidFileName)).toBe(false);
  });

  test('parts are 8 MiB, the last one holds the remainder', () => {
    expect(FILE_PART_BYTES).toBe(8 * 1024 * 1024);
    expect(partCountOf(1)).toBe(1);
    expect(partCountOf(FILE_PART_BYTES)).toBe(1);
    expect(partCountOf(FILE_PART_BYTES + 1)).toBe(2);
    expect(partCountOf(FILE_MAX_BYTES)).toBe(13);
    const size = FILE_PART_BYTES * 2 + 5;
    expect([1, 2, 3].map((part) => expectedPartSize(size, part))).toEqual([FILE_PART_BYTES, FILE_PART_BYTES, 5]);
    expect([0, 4, 1.5].map((part) => expectedPartSize(size, part))).toEqual([undefined, undefined, undefined]);
  });

  test('a content type is kept when it looks like one, otherwise it is octet-stream', () => {
    expect(normalizeContentType('application/pdf')).toBe('application/pdf');
    expect(normalizeContentType('text/plain; charset=utf-8')).toBe('text/plain; charset=utf-8');
    expect(normalizeContentType(undefined)).toBe('application/octet-stream');
    expect(normalizeContentType('')).toBe('application/octet-stream');
    expect(normalizeContentType('not a type')).toBe('application/octet-stream');
    expect(normalizeContentType(`text/${'x'.repeat(200)}`)).toBe('application/octet-stream');
  });

  test('sizes read as bytes, KiB or MiB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1536)).toBe('1.5 KiB');
    expect(formatFileSize(FILE_MAX_BYTES)).toBe('100.0 MiB');
  });
});

import { describe, expect, test } from 'bun:test';
import { DROP_MAX_TTL_MINUTES, DROP_MAX_VALUE_BYTES, isValidDropTtl, isValidDropValue } from './drop-limits.ts';

describe('drop limits (mcp AC-1.3, AC-1.4)', () => {
  test('a value must be non-empty and at most 16 KiB, measured in bytes', () => {
    expect(DROP_MAX_VALUE_BYTES).toBe(16 * 1024);
    expect(isValidDropValue('')).toBe(false);
    expect(isValidDropValue('x')).toBe(true);
    expect(isValidDropValue('a'.repeat(DROP_MAX_VALUE_BYTES))).toBe(true);
    expect(isValidDropValue('a'.repeat(DROP_MAX_VALUE_BYTES + 1))).toBe(false);
    /* U+00E9 is two bytes: half as many characters fill the same budget. */
    expect(isValidDropValue('é'.repeat(DROP_MAX_VALUE_BYTES / 2))).toBe(true);
    expect(isValidDropValue('é'.repeat(DROP_MAX_VALUE_BYTES / 2 + 1))).toBe(false);
  });

  test('a lifetime is a whole number of minutes between one and one day', () => {
    expect(DROP_MAX_TTL_MINUTES).toBe(1440);
    expect([1, 15, 1440].every(isValidDropTtl)).toBe(true);
    expect([0, -1, 1441, 2.5, Number.NaN, Number.POSITIVE_INFINITY].some(isValidDropTtl)).toBe(false);
  });
});

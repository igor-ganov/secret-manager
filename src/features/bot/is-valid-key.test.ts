import { describe, expect, test } from 'bun:test';
import { isValidKey } from './is-valid-key.ts';

describe('isValidKey', () => {
  test('accepts a short ascii key', () => {
    expect(isValidKey('api-key')).toBe(true);
  });

  test('accepts a key at the byte limit', () => {
    expect(isValidKey('a'.repeat(62))).toBe(true);
  });

  test('rejects a key over the byte limit', () => {
    expect(isValidKey('a'.repeat(63))).toBe(false);
  });

  test('measures multibyte characters in bytes, not characters', () => {
    expect(isValidKey('ключ'.repeat(8))).toBe(false);
    expect(isValidKey('ключ')).toBe(true);
  });

  test('rejects an empty key', () => {
    expect(isValidKey('')).toBe(false);
  });
});

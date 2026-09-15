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
    /* U+00E9 is one character but two UTF-8 bytes. */
    const twoByteCharacter = 'é';
    expect(isValidKey(twoByteCharacter.repeat(32))).toBe(false);
    expect(isValidKey(twoByteCharacter.repeat(31))).toBe(true);
  });

  test('rejects an empty key', () => {
    expect(isValidKey('')).toBe(false);
  });

  test('rejects keys containing whitespace', () => {
    expect(isValidKey('two words')).toBe(false);
    expect(isValidKey('tab\tkey')).toBe(false);
  });
});

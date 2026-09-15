import { describe, expect, test } from 'bun:test';
import { decodeBase64url } from './decode-base64url.ts';
import { parseTgAuthResult } from './parse-tg-auth-result.ts';

const encode = (value: unknown): string =>
  btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

describe('decodeBase64url', () => {
  test('restores padding and the standard alphabet', () => {
    expect(decodeBase64url(encode('a'))).toBe('"a"');
    expect(decodeBase64url(encode('ab'))).toBe('"ab"');
    expect(decodeBase64url(encode('abc'))).toBe('"abc"');
    expect(decodeBase64url(encode('??>'))).toBe('"??>"');
  });
});

describe('parseTgAuthResult', () => {
  test('decodes the payload Telegram appends to the fragment (AC-1.2)', () => {
    const payload = { id: 7, first_name: 'Ada', auth_date: 1, hash: 'h' };
    expect(parseTgAuthResult(`#tgAuthResult=${encode(payload)}`)).toEqual(payload);
  });

  test('ignores unrelated fragments and malformed payloads', () => {
    expect(parseTgAuthResult('')).toBeUndefined();
    expect(parseTgAuthResult('#section')).toBeUndefined();
    expect(parseTgAuthResult('#tgAuthResult=!!!')).toBeUndefined();
  });
});

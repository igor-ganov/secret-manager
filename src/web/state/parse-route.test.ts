import { describe, expect, test } from 'bun:test';
import { parseRoute } from './parse-route.ts';

describe('parseRoute', () => {
  test('recognises enrollment and device-login fragments', () => {
    expect(parseRoute('#enroll=abc_-1')).toEqual({ kind: 'enroll', code: 'abc_-1' });
    expect(parseRoute('#link=xyz')).toEqual({ kind: 'link', code: 'xyz' });
  });

  test('falls back to home for anything else', () => {
    expect(parseRoute('')).toEqual({ kind: 'home' });
    expect(parseRoute('#other=1')).toEqual({ kind: 'home' });
    expect(parseRoute('#link=')).toEqual({ kind: 'home' });
    expect(parseRoute('#link=a/b')).toEqual({ kind: 'home' });
  });
});

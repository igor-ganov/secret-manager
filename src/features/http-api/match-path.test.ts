import { describe, expect, test } from 'bun:test';
import { matchPath } from './match-path.ts';

describe('matchPath', () => {
  test('matches literal and parameter segments', () => {
    expect(matchPath('/api/secrets', '/api/secrets')).toEqual({});
    expect(matchPath('/api/secrets/:key/link', '/api/secrets/db/link')).toEqual({ key: 'db' });
  });

  test('decodes parameters and rejects empty or malformed ones', () => {
    expect(matchPath('/api/secrets/:key', '/api/secrets/a%2Fb')).toEqual({ key: 'a/b' });
    expect(matchPath('/api/secrets/:key', '/api/secrets/')).toBeUndefined();
    expect(matchPath('/api/secrets/:key', '/api/secrets/%E0%A4%A')).toBeUndefined();
  });

  test('rejects different lengths and literals', () => {
    expect(matchPath('/api/secrets', '/api/secrets/x')).toBeUndefined();
    expect(matchPath('/api/secrets', '/api/tokens')).toBeUndefined();
  });
});

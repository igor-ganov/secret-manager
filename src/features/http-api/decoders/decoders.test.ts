import { describe, expect, test } from 'bun:test';
import { decodeAuthConfig } from './decode-auth-config.ts';
import { decodeCreatedToken } from './decode-created-token.ts';
import { decodeIssuedLink } from './decode-issued-link.ts';
import { decodeKeys } from './decode-keys.ts';
import { decodeMe } from './decode-me.ts';
import { decodeSettings } from './decode-settings.ts';
import { decodeTokens } from './decode-tokens.ts';

const token = { id: 'a', label: 'cli', createdAt: 1, current: false };

describe('decoders', () => {
  test('accept well-formed wire objects', () => {
    expect(decodeMe({ id: 1, name: 'A' })).toEqual({ id: 1, name: 'A' });
    expect(decodeAuthConfig({ botId: 5 })).toEqual({ botId: 5 });
    expect(decodeIssuedLink({ url: 'u', curl: 'c', ttlMinutes: 5 })).toEqual({ url: 'u', curl: 'c', ttlMinutes: 5 });
    expect(decodeKeys({ keys: ['a'] })).toEqual({ keys: ['a'] });
    expect(decodeSettings({ linkTtlMinutes: 5, presets: [1, 5] })).toEqual({ linkTtlMinutes: 5, presets: [1, 5] });
    expect(decodeTokens({ tokens: [token] })).toEqual({ tokens: [token] });
    expect(decodeCreatedToken({ ...token, token: 't' })).toEqual({ ...token, token: 't' });
  });

  test('reject wrong shapes', () => {
    expect(decodeMe({ id: '1', name: 'A' })).toBeUndefined();
    expect(decodeAuthConfig({})).toBeUndefined();
    expect(decodeIssuedLink({ url: 'u' })).toBeUndefined();
    expect(decodeKeys({ keys: [1] })).toBeUndefined();
    expect(decodeSettings({ linkTtlMinutes: 5, presets: ['x'] })).toBeUndefined();
    expect(decodeTokens({ tokens: [{ id: 'a' }] })).toBeUndefined();
    expect(decodeCreatedToken(token)).toBeUndefined();
    expect(decodeMe([])).toBeUndefined();
    expect(decodeMe('x')).toBeUndefined();
  });
});

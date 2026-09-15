import { describe, expect, test } from 'bun:test';
import { createAccountId, isAccountId } from '../accounts/create-account-id.ts';
import { createRecoveryCode, normalizeRecoveryCode } from '../accounts/recovery-code.ts';
import { fromBase64url, randomBase64url, toBase64url } from '../crypto/base64url.ts';
import { createRateLimiter } from '../http-api/create-rate-limiter.ts';
import { webAuthnConfigFromUrl } from './webauthn-config.ts';

describe('account ids', () => {
  test('are safe integers above the Telegram id range and unique', () => {
    const ids = new Set(Array.from({ length: 50 }, createAccountId));
    expect(ids.size).toBe(50);
    ids.forEach((id) => expect(isAccountId(id)).toBe(true));
    expect(isAccountId(123456789)).toBe(false);
  });
});

describe('recovery codes (AC-4.2)', () => {
  test('are grouped and normalise back to 28 characters', () => {
    const code = createRecoveryCode();
    expect(code).toMatch(/^([a-z0-9]{4}-){6}[a-z0-9]{4}$/);
    expect(normalizeRecoveryCode(code.toUpperCase().replaceAll('-', ' '))).toBe(code.replaceAll('-', ''));
    expect(createRecoveryCode()).not.toBe(code);
  });
});

describe('base64url', () => {
  test('round-trips bytes without padding', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const encoded = toBase64url(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(Array.from(fromBase64url(encoded))).toEqual(Array.from(bytes));
    expect(randomBase64url(32)).toHaveLength(43);
  });
});

describe('rate limiter (AC-5.2)', () => {
  test('allows `limit` attempts per window, then resets', () => {
    const clock = { now: 0 };
    const limiter = createRateLimiter({ limit: 2, windowMs: 100, now: () => clock.now });
    expect(limiter.allow('a')).toBe(true);
    expect(limiter.allow('a')).toBe(true);
    expect(limiter.allow('a')).toBe(false);
    expect(limiter.allow('b')).toBe(true);
    clock.now = 100;
    expect(limiter.allow('a')).toBe(true);
  });
});

describe('webAuthnConfigFromUrl (AC-2.4)', () => {
  test('takes rp id and origin from the configured url', () => {
    expect(webAuthnConfigFromUrl('http://localhost:3000/')).toMatchObject({ rpId: 'localhost', origin: 'http://localhost:3000' });
  });
});

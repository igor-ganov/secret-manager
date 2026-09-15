import { describe, expect, test } from 'bun:test';
import { createHash, createHmac } from 'node:crypto';
import { parseTelegramLoginPayload } from './telegram-login-payload.ts';
import { buildDataCheckString, createTelegramLoginVerifier } from './verify-telegram-login.ts';

const BOT_TOKEN = '123456:ABC-DEF';
const NOW_MS = 1_700_000_000_000;

/* Independent implementation (node:crypto) of the Telegram signature. */
const sign = (fields: Readonly<Record<string, string | number>>): string => {
  const dataCheckString = Object.entries(fields)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([field, value]) => `${field}=${value}`)
    .join('\n');
  const secretKey = createHash('sha256').update(BOT_TOKEN).digest();
  return createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
};

const freshFields = {
  id: 42,
  first_name: 'Ada',
  last_name: 'Lovelace',
  username: 'ada',
  auth_date: Math.floor(NOW_MS / 1000) - 60,
};

const verify = createTelegramLoginVerifier({ botToken: BOT_TOKEN, now: () => NOW_MS });

describe('verifyTelegramLogin', () => {
  test('accepts a correctly signed fresh payload (AC-1.1)', async () => {
    const result = await verify({ ...freshFields, hash: sign(freshFields) });
    expect(result).toEqual({ ok: true, user: { id: 42, name: 'Ada Lovelace' } });
  });

  test('rejects a tampered payload (AC-1.2)', async () => {
    const result = await verify({ ...freshFields, id: 43, hash: sign(freshFields) });
    expect(result).toEqual({ ok: false, reason: 'bad-signature' });
  });

  test('rejects a payload older than a day (AC-1.3)', async () => {
    const stale = { ...freshFields, auth_date: Math.floor(NOW_MS / 1000) - 86_401 };
    const result = await verify({ ...stale, hash: sign(stale) });
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  test('falls back to username, then to the id, for the display name', async () => {
    const onlyUsername = { id: 7, username: 'seven', auth_date: freshFields.auth_date };
    const bare = { id: 8, auth_date: freshFields.auth_date };
    expect(await verify({ ...onlyUsername, hash: sign(onlyUsername) })).toMatchObject({
      user: { name: 'seven' },
    });
    expect(await verify({ ...bare, hash: sign(bare) })).toMatchObject({ user: { name: 'User 8' } });
  });

  test('data check string sorts fields and excludes the hash', () => {
    expect(buildDataCheckString({ id: 1, auth_date: 2, hash: 'x', first_name: 'A' })).toBe(
      'auth_date=2\nfirst_name=A\nid=1',
    );
  });
});

describe('parseTelegramLoginPayload', () => {
  test('keeps scalar fields and requires id, auth_date and hash', () => {
    expect(parseTelegramLoginPayload({ id: 1, auth_date: 2, hash: 'h', photo_url: 'p' })).toEqual({
      id: 1,
      auth_date: 2,
      hash: 'h',
      photo_url: 'p',
    });
    expect(parseTelegramLoginPayload({ id: '1', auth_date: 2, hash: 'h' })).toBeUndefined();
    expect(parseTelegramLoginPayload(['x'])).toBeUndefined();
    expect(parseTelegramLoginPayload('x')).toBeUndefined();
  });
});

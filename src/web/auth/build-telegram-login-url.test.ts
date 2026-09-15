import { describe, expect, test } from 'bun:test';
import { buildTelegramLoginUrl } from './build-telegram-login-url.ts';

describe('buildTelegramLoginUrl', () => {
  test('targets the oauth endpoint with bot id, origin and return url (AC-1.1)', () => {
    const url = new URL(buildTelegramLoginUrl(42, 'https://app.test'));
    expect(url.origin + url.pathname).toBe('https://oauth.telegram.org/auth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      bot_id: '42',
      origin: 'https://app.test',
      request_access: 'write',
      return_to: 'https://app.test/',
    });
  });
});

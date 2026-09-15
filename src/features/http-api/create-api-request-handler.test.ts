import { describe, expect, test } from 'bun:test';
import { createHash, createHmac } from 'node:crypto';
import { createApiTokenStore } from '../api-tokens/create-api-token-store.ts';
import { createOneTimeLinkStore } from '../one-time-links/create-one-time-link-store.ts';
import { createSecretStore } from '../secrets/create-secret-store.ts';
import { createSettingsStore } from '../settings/create-settings-store.ts';
import { createSharingService } from '../sharing/create-sharing-service.ts';
import { createUserStore } from '../users/create-user-store.ts';
import { createApiRequestHandler } from './create-api-request-handler.ts';

const BOT_TOKEN = '4242:SECRET';
const ORIGIN = 'https://app.test';
const NOW_MS = 1_700_000_000_000;

const signLogin = (fields: Readonly<Record<string, string | number>>) => {
  const dataCheckString = Object.entries(fields)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([field, value]) => `${field}=${value}`)
    .join('\n');
  const secretKey = createHash('sha256').update(BOT_TOKEN).digest();
  return { ...fields, hash: createHmac('sha256', secretKey).update(dataCheckString).digest('hex') };
};

const LOGIN = signLogin({ id: 7, first_name: 'Ada', auth_date: Math.floor(NOW_MS / 1000) - 5 });

const build = () => {
  let counter = 0;
  const links = createOneTimeLinkStore({
    ttlMs: 1,
    now: () => NOW_MS,
    createToken: () => `link${(counter += 1)}`,
  });
  const tokens = createApiTokenStore({ databasePath: ':memory:', now: () => NOW_MS });
  const handle = createApiRequestHandler({
    sharing: createSharingService({
      secrets: createSecretStore(':memory:'),
      links,
      settings: createSettingsStore(':memory:'),
      buildLinkUrl: (token) => `${ORIGIN}/s/${token}`,
      linkTtlMinutes: 5,
    }),
    tokens,
    users: createUserStore(':memory:'),
    botToken: BOT_TOKEN,
    now: () => NOW_MS,
  });

  type Options = {
    readonly method?: string;
    readonly body?: unknown;
    readonly headers?: Readonly<Record<string, string>>;
  };
  const call = (path: string, { method = 'GET', body, headers = {} }: Options = {}) =>
    handle(
      new Request(`${ORIGIN}${path}`, {
        method,
        headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );

  const asBearer = async (userId = 7) => {
    const { token } = await tokens.create(userId, 'cli');
    return (path: string, options: Options = {}) =>
      call(path, { ...options, headers: { authorization: `Bearer ${token}`, ...options.headers } });
  };

  const asCookie = async () => {
    const login = await call('/api/auth/telegram', { method: 'POST', body: LOGIN, headers: { origin: ORIGIN } });
    const cookie = login.headers.get('set-cookie') ?? '';
    const session = cookie.split(';')[0] ?? '';
    return (path: string, options: Options = {}) =>
      call(path, { ...options, headers: { cookie: session, ...options.headers } });
  };

  return { call, asBearer, asCookie, links, tokens };
};

describe('auth routes', () => {
  test('exposes the bot id (AC-1.5)', async () => {
    const { call } = build();
    const response = await call('/api/auth/config');
    expect(await response.json()).toEqual({ botId: 4242 });
  });

  test('a verified Telegram login sets an HttpOnly session cookie (AC-1.1)', async () => {
    const { call } = build();
    const response = await call('/api/auth/telegram', { method: 'POST', body: LOGIN, headers: { origin: ORIGIN } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 7, name: 'Ada' });
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^session=[0-9a-f]{64}; Max-Age=\d+; Path=\/; HttpOnly; SameSite=Strict; Secure$/);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  test('a forged login is rejected without a cookie (AC-1.2)', async () => {
    const { call } = build();
    const response = await call('/api/auth/telegram', {
      method: 'POST',
      body: { ...LOGIN, id: 8 },
      headers: { origin: ORIGIN },
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  test('a login posted from another origin is rejected (login CSRF)', async () => {
    const { call } = build();
    const response = await call('/api/auth/telegram', { method: 'POST', body: LOGIN, headers: { origin: 'https://evil.test' } });
    expect(response.status).toBe(403);
  });

  test('logout revokes the session and clears the cookie (AC-1.4)', async () => {
    const { asCookie } = build();
    const call = await asCookie();
    const logout = await call('/api/auth/logout', { method: 'POST', headers: { origin: ORIGIN } });
    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await call('/api/me')).status).toBe(401);
  });

  test('/api/me reports the logged-in user (AC-2.1)', async () => {
    const { asCookie } = build();
    const call = await asCookie();
    expect(await (await call('/api/me')).json()).toEqual({ id: 7, name: 'Ada' });
  });
});

describe('authentication and CSRF', () => {
  test('protected routes answer 401 without credentials (AC-2.2)', async () => {
    const { call } = build();
    expect((await call('/api/secrets')).status).toBe(401);
    expect((await call('/api/secrets', { headers: { authorization: 'Bearer nope' } })).status).toBe(401);
  });

  test('cookie-authenticated mutations need a same-origin Origin header (AC-2.3)', async () => {
    const { asCookie } = build();
    const call = await asCookie();
    const foreign = await call('/api/links', { method: 'POST', body: { value: 'v' }, headers: { origin: 'https://evil.test' } });
    expect(foreign.status).toBe(403);
    const missing = await call('/api/links', { method: 'POST', body: { value: 'v' } });
    expect(missing.status).toBe(403);
    const same = await call('/api/links', { method: 'POST', body: { value: 'v' }, headers: { origin: ORIGIN } });
    expect(same.status).toBe(201);
  });

  test('bearer requests need no Origin header', async () => {
    const { asBearer } = build();
    const call = await asBearer();
    expect((await call('/api/links', { method: 'POST', body: { value: 'v' } })).status).toBe(201);
  });

  test('unknown paths are 404 and wrong methods are 405', async () => {
    const { asBearer } = build();
    const call = await asBearer();
    expect((await call('/api/nothing')).status).toBe(404);
    expect((await call('/api/settings', { method: 'DELETE' })).status).toBe(405);
  });
});

describe('secrets and links', () => {
  test('sharing a bare value issues a link and saves nothing (AC-4.1)', async () => {
    const { asBearer, links } = build();
    const call = await asBearer();
    const response = await call('/api/links', { method: 'POST', body: { value: 'plain' } });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      url: `${ORIGIN}/s/link1`,
      curl: `curl -X POST ${ORIGIN}/s/link1`,
      ttlMinutes: 5,
    });
    expect(await links.consume('link1')).toBe('plain');
    expect(await (await call('/api/secrets')).json()).toEqual({ keys: [] });
  });

  test('sharing with a key saves the pair (AC-4.2, AC-4.4, AC-4.5)', async () => {
    const { asBearer } = build();
    const call = await asBearer();
    await call('/api/links', { method: 'POST', body: { key: 'db', value: 'pw' } });
    expect(await (await call('/api/secrets')).json()).toEqual({ keys: ['db'] });
    expect(await (await call('/api/secrets/db')).json()).toEqual({ value: 'pw' });
  });

  test('invalid keys and empty values are 400 (AC-4.3)', async () => {
    const { asBearer } = build();
    const call = await asBearer();
    expect((await call('/api/links', { method: 'POST', body: { key: 'a b', value: 'v' } })).status).toBe(400);
    expect((await call('/api/links', { method: 'POST', body: { key: 'a'.repeat(63), value: 'v' } })).status).toBe(400);
    expect((await call('/api/links', { method: 'POST', body: { value: '' } })).status).toBe(400);
    expect((await call('/api/links', { method: 'POST', body: 'text' })).status).toBe(400);
  });

  test('put, link and delete a stored key (AC-4.6, AC-4.7, AC-4.8)', async () => {
    const { asBearer, links } = build();
    const call = await asBearer();
    expect((await call('/api/secrets/k%2Fx', { method: 'PUT', body: { value: 'one' } })).status).toBe(204);
    expect(await (await call('/api/secrets/k%2Fx')).json()).toEqual({ value: 'one' });
    const link = await call('/api/secrets/k%2Fx/link', { method: 'POST' });
    expect(link.status).toBe(201);
    expect(await links.consume('link1')).toBe('one');
    expect((await call('/api/secrets/k%2Fx', { method: 'DELETE' })).status).toBe(204);
    expect((await call('/api/secrets/k%2Fx')).status).toBe(404);
    expect((await call('/api/secrets/k%2Fx/link', { method: 'POST' })).status).toBe(404);
  });

  test('users never see each other\'s keys (AC-4.9)', async () => {
    const { asBearer } = build();
    const alice = await asBearer(1);
    const bob = await asBearer(2);
    await alice('/api/links', { method: 'POST', body: { key: 'shared', value: 'a' } });
    expect(await (await bob('/api/secrets')).json()).toEqual({ keys: [] });
    expect((await bob('/api/secrets/shared')).status).toBe(404);
  });
});

describe('settings', () => {
  test('reads and updates the link lifetime within presets (AC-5.1, AC-5.2)', async () => {
    const { asBearer } = build();
    const call = await asBearer();
    expect(await (await call('/api/settings')).json()).toEqual({
      linkTtlMinutes: 5,
      presets: [1, 5, 15, 30, 60, 1440],
    });
    expect((await call('/api/settings', { method: 'PUT', body: { linkTtlMinutes: 30 } })).status).toBe(204);
    expect((await call('/api/settings', { method: 'PUT', body: { linkTtlMinutes: 7 } })).status).toBe(400);
    expect(await (await call('/api/settings')).json()).toMatchObject({ linkTtlMinutes: 30 });
    const link = await (await call('/api/links', { method: 'POST', body: { value: 'v' } })).json();
    expect(link).toMatchObject({ ttlMinutes: 30 });
  });
});

describe('tokens', () => {
  test('create, list (marking the current one) and revoke (AC-3.1–3.3)', async () => {
    const { asBearer } = build();
    const call = await asBearer();
    const created = await call('/api/tokens', { method: 'POST', body: { label: 'laptop' } });
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody).toMatchObject({ label: 'laptop', current: false });
    expect(createdBody.token).toMatch(/^[0-9a-f]{64}$/);

    const listed = await (await call('/api/tokens')).json();
    expect(listed.tokens.map((token: { label: string; current: boolean }) => [token.label, token.current])).toEqual([
      ['cli', true],
      ['laptop', false],
    ]);
    expect(JSON.stringify(listed)).not.toContain(createdBody.token);

    expect((await call(`/api/tokens/${createdBody.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await call(`/api/tokens/${createdBody.id}`, { method: 'DELETE' })).status).toBe(404);
    expect((await call('/api/tokens', { method: 'POST', body: { label: '' } })).status).toBe(400);
  });
});

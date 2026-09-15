import { describe, expect, test } from 'bun:test';
import { createLocalApp } from '../app/create-local-app.ts';
import { createFakeCeremonies } from '../passkeys/create-fake-ceremonies.ts';

const ORIGIN = 'https://app.test';

type Options = {
  readonly method?: string;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
};

const build = () => {
  const app = createLocalApp(
    { botToken: '4242:SECRET', port: 0, baseUrl: ORIGIN, databasePath: ':memory:', linkTtlMinutes: 5 },
    { ceremonies: createFakeCeremonies() },
  );

  const call = (path: string, { method = 'GET', body, headers = {} }: Options = {}) =>
    app.handleRequest(
      new Request(`${ORIGIN}${path}`, {
        method,
        headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );

  const asBearer = async (accountId: number) => {
    const { token } = await app.tokens.create(accountId, 'cli');
    return (path: string, options: Options = {}) =>
      call(path, { ...options, headers: { authorization: `Bearer ${token}`, ...options.headers } });
  };

  const post = (path: string, body: unknown = {}, headers: Readonly<Record<string, string>> = {}) =>
    call(path, { method: 'POST', body, headers: { origin: ORIGIN, ...headers } });

  const withCookie = (response: Response) => {
    const session = (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    return (path: string, options: Options = {}) =>
      call(path, { ...options, headers: { cookie: session, origin: ORIGIN, ...options.headers } });
  };

  /* Full signup through the fake ceremony: returns the signed-in caller. */
  const signUp = async (name = 'Ada', credentialId = 'cred-1') => {
    const options = await (await post('/api/passkeys/register/options', { name })).json();
    const verify = await post('/api/passkeys/register/verify', {
      response: { challenge: options.options.challenge, id: credentialId },
      label: 'Laptop',
    });
    return { verify, body: await verify.clone().json(), as: withCookie(verify) };
  };

  return { app, call, post, asBearer, withCookie, signUp };
};

describe('signup and login (passkey-accounts AC-1.x, AC-2.x)', () => {
  test('creates an account, sets a session and shows the recovery code once', async () => {
    const { signUp } = build();
    const { verify, body, as } = await signUp();
    expect(verify.status).toBe(201);
    expect(body).toMatchObject({ name: 'Ada' });
    expect(body.recoveryCode).toMatch(/^([a-z0-9]{4}-){6}[a-z0-9]{4}$/);
    expect(body.id).toBeGreaterThan(2 ** 40);
    expect(verify.headers.get('set-cookie')).toMatch(/^session=[0-9a-f]{64};.*HttpOnly; SameSite=Strict; Secure$/);
    expect(await (await as('/api/me')).json()).toEqual({ id: body.id, name: 'Ada' });
  });

  test('rejects a failed ceremony, an unknown challenge and a reused challenge (AC-1.4, AC-2.3)', async () => {
    const { post } = build();
    const options = await (await post('/api/passkeys/register/options', { name: 'Ada' })).json();
    const challenge = options.options.challenge;
    expect((await post('/api/passkeys/register/verify', { response: { challenge, id: 'c', fail: true } })).status).toBe(400);
    expect((await post('/api/passkeys/register/verify', { response: { challenge, id: 'c' } })).status).toBe(400);
    expect((await post('/api/passkeys/register/verify', { response: { challenge: 'nope', id: 'c' } })).status).toBe(400);
  });

  test('logs in with a registered credential and tracks the counter (AC-2.1, AC-2.2)', async () => {
    const { post, signUp, withCookie } = build();
    const { body } = await signUp('Ada', 'cred-1');
    const login = async (counter: number) => {
      const options = await (await post('/api/passkeys/login/options')).json();
      return post('/api/passkeys/login/verify', { response: { challenge: options.options.challenge, id: 'cred-1', counter } });
    };
    const first = await login(5);
    expect(first.status).toBe(200);
    expect(await (await withCookie(first)('/api/me')).json()).toEqual({ id: body.id, name: 'Ada' });
    expect((await login(5)).status).toBe(400);
    expect((await login(6)).status).toBe(200);
    const unknownOptions = await (await post('/api/passkeys/login/options')).json();
    expect((await post('/api/passkeys/login/verify', { response: { challenge: unknownOptions.options.challenge, id: 'ghost' } })).status).toBe(400);
  });

  test('adds and removes passkeys, never the last one (AC-3.4)', async () => {
    const { signUp } = build();
    const { as } = await signUp();
    const options = await (await as('/api/passkeys/add/options', { method: 'POST' })).json();
    expect(options.options.exclude).toEqual(['cred-1']);
    expect((await as('/api/passkeys/add/verify', { method: 'POST', body: { response: { challenge: options.options.challenge, id: 'cred-2' }, label: 'Phone' } })).status).toBe(204);
    const devices = await (await as('/api/devices')).json();
    expect(devices.passkeys.map((passkey: { label: string }) => passkey.label)).toEqual(['Laptop', 'Phone']);
    expect((await as('/api/passkeys/cred-2', { method: 'DELETE' })).status).toBe(204);
    expect((await as('/api/passkeys/cred-1', { method: 'DELETE' })).status).toBe(400);
  });
});

describe('enrollment links (AC-3.1–3.3)', () => {
  test('a signed-in device mints a link another device registers through, once', async () => {
    const { signUp, call, post, withCookie } = build();
    const { as, body: owner } = await signUp();
    const created = await as('/api/enrollments', { method: 'POST' });
    expect(created.status).toBe(201);
    const enrollment = await created.json();
    expect(enrollment.url).toMatch(new RegExp(`^${ORIGIN}/#enroll=[A-Za-z0-9_-]{43}$`));
    expect(enrollment.qr).toMatch(/^data:image\/svg\+xml;base64,/);
    const code = enrollment.url.split('#enroll=')[1];

    expect(await (await call(`/api/enrollments/${code}`)).json()).toEqual({ accountName: 'Ada' });
    const options = await (await post(`/api/enrollments/${code}/options`)).json();
    const verify = await post(`/api/enrollments/${code}/verify`, { response: { challenge: options.options.challenge, id: 'cred-phone' }, label: 'Phone' });
    expect(verify.status).toBe(200);
    expect(await verify.clone().json()).toEqual({ id: owner.id, name: 'Ada' });
    const devices = await (await withCookie(verify)('/api/devices')).json();
    expect(devices.passkeys).toHaveLength(2);

    expect((await call(`/api/enrollments/${code}`)).status).toBe(404);
    expect((await post(`/api/enrollments/${code}/options`)).status).toBe(404);
    expect((await call('/api/enrollments/unknown')).status).toBe(404);
  });
});

describe('recovery (AC-4.x)', () => {
  test('a valid code registers a new passkey and rotates the code', async () => {
    const { signUp, post, withCookie } = build();
    const { body } = await signUp();
    const options = await (await post('/api/recovery/options', { code: body.recoveryCode.toUpperCase() })).json();
    const verify = await post('/api/recovery/verify', { code: body.recoveryCode, response: { challenge: options.options.challenge, id: 'cred-new' } });
    expect(verify.status).toBe(200);
    const recovered = await verify.clone().json();
    expect(recovered.recoveryCode).not.toBe(body.recoveryCode);
    expect(await (await withCookie(verify)('/api/me')).json()).toEqual({ id: body.id, name: 'Ada' });
    expect((await post('/api/recovery/options', { code: body.recoveryCode })).status).toBe(400);
    expect((await post('/api/recovery/options', { code: 'wrong' })).status).toBe(400);
  });
});

describe('device login (device-login AC-2.x, AC-3.x)', () => {
  const CALLBACK = 'http://127.0.0.1:4242/callback';
  const claim = (call: ReturnType<typeof build>['call'], secret: string, grant: string) =>
    call('/api/device/claim', { method: 'POST', body: { grant }, headers: { 'x-device-secret': secret } });

  test('approval mints a grant; secret + grant claim the token exactly once', async () => {
    const { call, post, signUp, app } = build();
    const started = await post('/api/device/start', { label: 'laptop', callback: CALLBACK });
    expect(started.status).toBe(201);
    const { url, deviceSecret } = await started.json();
    const code = url.split('#link=')[1];
    expect((await claim(call, deviceSecret, 'abcd-efgh')).status).toBe(410);

    const { as } = await signUp();
    expect(await (await as(`/api/device/${code}`)).json()).toEqual({ kind: 'cli', label: 'laptop', status: 'pending', grant: '', callback: CALLBACK });
    const approval = await as(`/api/device/${code}/approve`, { method: 'POST' });
    expect(approval.status).toBe(200);
    const { grant, callback } = await approval.json();
    expect(grant).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}$/);
    expect(callback).toBe(CALLBACK);
    expect(await (await as(`/api/device/${code}`)).json()).toMatchObject({ status: 'approved', grant });
    expect((await as(`/api/device/${code}/approve`, { method: 'POST' })).status).toBe(404);

    expect((await claim(call, code, grant)).status).toBe(410);
    const claimed = await claim(call, deviceSecret, grant.toUpperCase().replace('-', ' '));
    expect(claimed.status).toBe(200);
    const { token } = await claimed.json();
    expect((await claim(call, deviceSecret, grant)).status).toBe(410);

    const me = await (await call('/api/me', { headers: { authorization: `Bearer ${token}` } })).json();
    expect(me.name).toBe('Ada');
    /* The web session from signup plus the CLI token just issued. */
    expect((await app.tokens.list(me.id)).map((record) => record.label)).toEqual(['web', 'laptop']);
  });

  test('callbacks must be loopback urls; denied requests yield nothing', async () => {
    const { call, post, signUp } = build();
    expect((await post('/api/device/start', { label: 'laptop', callback: 'https://evil.test/callback' })).status).toBe(400);
    const { url, deviceSecret } = await (await post('/api/device/start', { label: 'laptop' })).json();
    const code = url.split('#link=')[1];
    const { as } = await signUp();
    expect((await as(`/api/device/${code}/deny`, { method: 'POST' })).status).toBe(204);
    expect((await claim(call, deviceSecret, 'abcd-efgh')).status).toBe(410);
    expect((await as(`/api/device/${code}/approve`, { method: 'POST' })).status).toBe(404);
    expect((await as(`/api/device/${code}`)).status).toBe(404);
  });

  test('approving a Telegram request links the chat and migrates legacy data (AC-1.2)', async () => {
    const { signUp, app } = build();
    await app.sharing.save(555, 'legacy-key', 'legacy-value');
    const { url } = await app.deviceLogin.start({ kind: 'telegram', label: 'Telegram chat @ada', subject: '555', callback: '' });
    const code = url.split('#link=')[1];
    const { as, body } = await signUp();
    const approval = await as(`/api/device/${code}/approve`, { method: 'POST' });
    expect(await approval.json()).toEqual({ kind: 'telegram', grant: '', callback: '' });
    expect(await app.telegramLinks.accountFor(555)).toBe(body.id);
    expect(await (await as('/api/secrets')).json()).toEqual({ keys: ['legacy-key'] });
    expect((await (await as('/api/devices')).json()).telegram).toEqual({ linked: true });
    expect((await as('/api/telegram', { method: 'DELETE' })).status).toBe(204);
    expect(await app.telegramLinks.accountFor(555)).toBeUndefined();
  });
});

describe('authentication and CSRF', () => {
  test('protected routes answer 401 without credentials and 403 cross-site (AC-2.2, AC-2.3)', async () => {
    const { call, signUp } = build();
    expect((await call('/api/secrets')).status).toBe(401);
    expect((await call('/api/secrets', { headers: { authorization: 'Bearer nope' } })).status).toBe(401);
    const { as } = await signUp();
    const foreign = await as('/api/links', { method: 'POST', body: { value: 'v' }, headers: { origin: 'https://evil.test' } });
    expect(foreign.status).toBe(403);
    const same = await as('/api/links', { method: 'POST', body: { value: 'v' } });
    expect(same.status).toBe(201);
  });

  test('cookie-less clients may POST public routes without an Origin header (CLI)', async () => {
    const { call, signUp } = build();
    expect((await call('/api/device/start', { method: 'POST', body: { label: 'cli' } })).status).toBe(201);
    const { as } = await signUp();
    const crossSite = await as('/api/device/start', { method: 'POST', body: { label: 'cli' }, headers: { origin: 'https://evil.test' } });
    expect(crossSite.status).toBe(403);
  });

  test('ceremony endpoints are rate limited (AC-5.2)', async () => {
    const { post } = build();
    const statuses = await Promise.all(
      Array.from({ length: 31 }, () => post('/api/passkeys/login/options', {}, { 'cf-connecting-ip': '10.0.0.1' })),
    );
    expect(statuses.map((response) => response.status).filter((status) => status === 429)).toHaveLength(1);
  });

  test('logout revokes the session and clears the cookie', async () => {
    const { signUp } = build();
    const { as } = await signUp();
    const logout = await as('/api/auth/logout', { method: 'POST' });
    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await as('/api/me')).status).toBe(401);
  });
});

describe('secrets, links and settings', () => {
  test('sharing, saving, linking, deleting and settings work for the account (http-api AC-4.x, AC-5.x)', async () => {
    const { asBearer } = build();
    const call = await asBearer(2 ** 40 + 7);
    const shared = await (await call('/api/links', { method: 'POST', body: { value: 'plain' } })).json();
    expect(shared).toMatchObject({ curl: `curl -X POST ${shared.url}`, ttlMinutes: 5 });
    await call('/api/links', { method: 'POST', body: { key: 'db', value: 'pw' } });
    expect(await (await call('/api/secrets')).json()).toEqual({ keys: ['db'] });
    expect(await (await call('/api/secrets/db')).json()).toEqual({ value: 'pw' });
    expect((await call('/api/links', { method: 'POST', body: { key: 'a b', value: 'v' } })).status).toBe(400);
    expect((await call('/api/secrets/db', { method: 'PUT', body: { value: 'one' } })).status).toBe(204);
    expect((await call('/api/secrets/db/link', { method: 'POST' })).status).toBe(201);
    expect((await call('/api/secrets/db', { method: 'DELETE' })).status).toBe(204);
    expect((await call('/api/secrets/db')).status).toBe(404);
    expect((await call('/api/settings', { method: 'PUT', body: { linkTtlMinutes: 30 } })).status).toBe(204);
    expect((await call('/api/settings', { method: 'PUT', body: { linkTtlMinutes: 7 } })).status).toBe(400);
    expect(await (await call('/api/settings')).json()).toMatchObject({ linkTtlMinutes: 30 });
  });

  test('users never see each other\'s keys and tokens can be revoked', async () => {
    const { asBearer } = build();
    const alice = await asBearer(2 ** 40 + 1);
    const bob = await asBearer(2 ** 40 + 2);
    await alice('/api/links', { method: 'POST', body: { key: 'shared', value: 'a' } });
    expect(await (await bob('/api/secrets')).json()).toEqual({ keys: [] });
    const devices = await (await alice('/api/devices')).json();
    expect(devices.tokens).toHaveLength(1);
    expect((await alice(`/api/tokens/${devices.tokens[0].id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await alice('/api/me')).status).toBe(401);
  });
});

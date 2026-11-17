import { describe, expect, test } from 'bun:test';
import { createApiClient, createPublicClient, type FetchFn } from './create-api-client.ts';

const CREDENTIALS = { serverUrl: 'https://s.test/', token: 'tok' };

const respond =
  (status: number, body: string, seen: { url?: string; init?: RequestInit } = {}): FetchFn =>
  async (url, init) => {
    seen.url = url;
    seen.init = init;
    return new Response(body, { status });
  };

describe('cli createApiClient', () => {
  test('sends the bearer token to the trimmed server url', async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const client = createApiClient(respond(200, '{"keys":[]}', seen))(CREDENTIALS);
    expect(await client.keys()).toEqual({ ok: true, value: { keys: [] } });
    expect(seen.url).toBe('https://s.test/api/secrets');
    expect(new Headers(seen.init?.headers).get('authorization')).toBe('Bearer tok');
  });

  test('maps 401 to unauthorized (AC-2.6)', async () => {
    const client = createApiClient(respond(401, '{"error":"x"}'))(CREDENTIALS);
    expect(await client.me()).toEqual({ ok: false, error: { kind: 'unauthorized' } });
  });

  test('maps other errors to the server message (AC-3.2)', async () => {
    const client = createApiClient(respond(400, '{"error":"Bad key."}'))(CREDENTIALS);
    expect(await client.share('a b', 'v')).toEqual({ ok: false, error: { kind: 'rejected', message: 'Bad key.' } });
  });

  test('maps network failures to unreachable', async () => {
    const client = createApiClient(async () => {
      throw new Error('ECONNREFUSED');
    })(CREDENTIALS);
    expect(await client.me()).toMatchObject({ ok: false, error: { kind: 'unreachable' } });
  });

  test('reads a stored value (AC-3.4)', async () => {
    const client = createApiClient(respond(200, '{"value":"v"}'))(CREDENTIALS);
    expect(await client.read('k')).toEqual({ ok: true, value: { value: 'v' } });
  });
});

describe('cli createPublicClient (device-login AC-2.x, mcp AC-2.3)', () => {
  test('starts a request with its callback and claims with the device secret', async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const device = createPublicClient(respond(201, '{"url":"u","deviceSecret":"p","expiresAt":1}', seen))('https://s.test');
    expect(await device.start('laptop', 'http://127.0.0.1:5/callback')).toEqual({ ok: true, value: { url: 'u', deviceSecret: 'p', expiresAt: 1 } });
    expect(new Headers(seen.init?.headers).has('authorization')).toBe(false);
    expect(seen.init?.body).toBe('{"label":"laptop","callback":"http://127.0.0.1:5/callback"}');

    const claimer = createPublicClient(respond(200, '{"token":"t"}', seen))('https://s.test');
    expect(await claimer.claim('p', 'abcd-efgh')).toEqual({ ok: true, value: { token: 't' } });
    expect(new Headers(seen.init?.headers).get('x-device-secret')).toBe('p');
    expect(await createPublicClient(respond(410, '{"error":"gone"}'))('https://s.test').claim('p', 'x')).toEqual({
      ok: false,
      error: { kind: 'rejected', message: 'gone' },
    });
  });

  test('drops a value with a lifetime and gets the link back, without credentials', async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const link = { url: 'https://s.test/s/t', curl: 'curl -X POST https://s.test/s/t', ttlMinutes: 90 };
    const client = createPublicClient(respond(201, JSON.stringify(link), seen))('https://s.test/');
    expect(await client.drop('v', 90)).toEqual({ ok: true, value: link });
    expect(seen.url).toBe('https://s.test/api/drops');
    expect(seen.init?.body).toBe('{"value":"v","ttlMinutes":90}');
    expect(new Headers(seen.init?.headers).has('authorization')).toBe(false);
    expect(await createPublicClient(respond(400, '{"error":"Too long."}'))('https://s.test').drop('v', 1)).toEqual({
      ok: false,
      error: { kind: 'rejected', message: 'Too long.' },
    });
  });
});

describe('cli file uploads (secret-files AC-1.1, AC-1.2, AC-1.5–1.7)', () => {
  test('parts go up as raw bytes; begin, drop, complete and abort hit their routes', async () => {
    const seen: { url?: string; init?: RequestInit }[] = [];
    const fetchFn: FetchFn = async (url, init) => {
      seen.push({ url, init });
      return new Response(url.endsWith('/parts/2') ? '' : '{"uploadId":"u","partSize":4,"partCount":2,"expiresAt":1}', { status: url.endsWith('/parts/2') ? 204 : 201 });
    };
    expect(await createApiClient(fetchFn)(CREDENTIALS).beginFile('a.txt', 5, 'text/plain')).toMatchObject({ ok: true, value: { uploadId: 'u' } });
    const client = createPublicClient(fetchFn)('https://s.test');
    await client.dropFile('a.txt', 5, 'text/plain', 15);
    expect(await client.putPart('u/1', 2, new TextEncoder().encode('abcd'))).toEqual({ ok: true, value: true });
    await client.completeUpload('u/1');
    await client.abortUpload('u/1');
    expect(seen.map(({ url, init }) => `${init?.method ?? ''} ${url}`)).toEqual([
      'POST https://s.test/api/files',
      'POST https://s.test/api/file-drops',
      'PUT https://s.test/api/uploads/u%2F1/parts/2',
      'POST https://s.test/api/uploads/u%2F1/complete',
      'DELETE https://s.test/api/uploads/u%2F1',
    ]);
    expect(new Headers(seen[2]?.init?.headers).get('content-type')).toBe('application/octet-stream');
    expect(seen[2]?.init?.body).toEqual(new TextEncoder().encode('abcd'));
    expect(JSON.parse(String(seen[1]?.init?.body))).toEqual({ name: 'a.txt', size: 5, contentType: 'text/plain', ttlMinutes: 15 });
  });
});

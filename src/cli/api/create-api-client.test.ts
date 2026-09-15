import { describe, expect, test } from 'bun:test';
import { createApiClient, type FetchFn } from './create-api-client.ts';

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

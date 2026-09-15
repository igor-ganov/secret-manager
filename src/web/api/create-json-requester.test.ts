import { describe, expect, test } from 'bun:test';
import { createJsonRequester, type FetchFn } from './create-json-requester.ts';
import { decodeEmpty } from '../../features/http-api/decoders/decode-empty.ts';
import { decodeMe } from '../../features/http-api/decoders/decode-me.ts';
import { matchResult } from '../../features/result/match-result.ts';
import { readErrorMessage } from '../../features/http-api/read-error-message.ts';
import { valueOr } from '../../features/result/value-or.ts';

const respond =
  (status: number, body: string): FetchFn =>
  async () =>
    new Response(body, { status });

describe('createJsonRequester', () => {
  test('decodes a successful body', async () => {
    const request = createJsonRequester(respond(200, '{"id":1,"name":"Ada"}'));
    expect(await request('GET', '/api/me', decodeMe)).toEqual({ ok: true, value: { id: 1, name: 'Ada' } });
  });

  test('treats an empty 204 body as success', async () => {
    const request = createJsonRequester(respond(204, ''));
    expect(await request('DELETE', '/x', decodeEmpty)).toEqual({ ok: true, value: true });
  });

  test('surfaces the server error message, or a status fallback', async () => {
    expect(await createJsonRequester(respond(400, '{"error":"Bad key."}'))('POST', '/x', decodeEmpty)).toEqual({
      ok: false,
      error: 'Bad key.',
    });
    expect(await createJsonRequester(respond(502, ''))('GET', '/x', decodeEmpty)).toEqual({
      ok: false,
      error: 'Request failed (502).',
    });
  });

  test('rejects an unexpected shape', async () => {
    const request = createJsonRequester(respond(200, '{"id":"1"}'));
    expect(await request('GET', '/api/me', decodeMe)).toMatchObject({ ok: false });
  });

  test('sends json bodies with same-origin credentials and no body for bodiless calls', async () => {
    const seen: RequestInit[] = [];
    const request = createJsonRequester(async (_input, init) => {
      seen.push(init);
      return new Response('{}', { status: 200 });
    });
    await request('POST', '/x', decodeEmpty, { value: 'v' });
    await request('GET', '/x', decodeEmpty);
    expect(seen[0]).toMatchObject({ method: 'POST', body: '{"value":"v"}', credentials: 'same-origin' });
    expect(seen[1]).not.toHaveProperty('body');
  });
});

describe('result helpers', () => {
  test('matchResult and valueOr pick the right branch', () => {
    expect(matchResult({ ok: true, value: 2 }, (v) => v * 2, () => 0)).toBe(4);
    expect(matchResult({ ok: false, error: 'e' }, (v: number) => v * 2, () => 0)).toBe(0);
    expect(valueOr({ ok: false, error: 'e' }, 'fallback')).toBe('fallback');
    expect(readErrorMessage({ error: 'x' }, 500)).toBe('x');
    expect(readErrorMessage([], 500)).toBe('Request failed (500).');
  });
});

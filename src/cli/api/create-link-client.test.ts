import { describe, expect, test } from 'bun:test';
import type { FetchFn } from './create-api-client.ts';
import { createLinkClient } from './create-link-client.ts';

const URL_ = 'https://s.test/s/tok';

const respond =
  (response: () => Response, seen: { url?: string; init?: RequestInit } = {}): FetchFn =>
  async (url, init) => {
    seen.url = url;
    seen.init = init;
    return response();
  };

describe('createLinkClient (secret-files AC-2.4, AC-5.2)', () => {
  test('peek asks for JSON with a GET, so the link survives', async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const client = createLinkClient(respond(() => Response.json({ kind: 'file', name: 'a.txt', size: 3 }), seen));
    expect(await client.peek(URL_)).toEqual({ ok: true, value: { kind: 'file', name: 'a.txt', size: 3 } });
    expect(seen.url).toBe(URL_);
    expect(seen.init?.method).toBe('GET');
    expect(new Headers(seen.init?.headers).get('accept')).toBe('application/json');
  });

  test('a dead link is rejected with the server message', async () => {
    const client = createLinkClient(respond(() => Response.json({ error: 'This link has already been used or has expired.' }, { status: 410 })));
    expect(await client.peek(URL_)).toEqual({ ok: false, error: { kind: 'rejected', message: 'This link has already been used or has expired.' } });
    const opened = createLinkClient(respond(() => new Response('This link has already been used or has expired.\n', { status: 410 })));
    expect(await opened.open(URL_)).toEqual({ ok: false, error: { kind: 'rejected', message: 'This link has already been used or has expired.' } });
  });

  test('open POSTs: text comes back without the trailing newline, a file as a stream', async () => {
    const text = createLinkClient(respond(() => new Response('two\nlines\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } })));
    expect(await text.open(URL_)).toEqual({ ok: true, value: { kind: 'text', value: 'two\nlines' } });
    const seen: { url?: string; init?: RequestInit } = {};
    const file = createLinkClient(
      respond(() => new Response('bytes', { headers: { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment' } }), seen),
    );
    const result = await file.open(URL_);
    expect(seen.init?.method).toBe('POST');
    expect(result.ok && result.value.kind === 'file' ? await new Response(result.value.body).text() : '').toBe('bytes');
  });

  test('a network failure is unreachable', async () => {
    const client = createLinkClient(async () => {
      throw new Error('ECONNREFUSED');
    });
    expect(await client.open(URL_)).toMatchObject({ ok: false, error: { kind: 'unreachable' } });
  });
});

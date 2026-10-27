import { describe, expect, test } from 'bun:test';
import { createLocalApp } from '../app/create-local-app.ts';
import { createFakeCeremonies } from '../passkeys/create-fake-ceremonies.ts';
import { FILE_PART_BYTES } from '../secret-files/file-limits.ts';

const ORIGIN = 'https://app.test';
const ACCOUNT = 2 ** 40 + 21;

type Init = { readonly method?: string; readonly json?: unknown; readonly bytes?: Uint8Array<ArrayBuffer>; readonly headers?: Readonly<Record<string, string>> };

const build = () => {
  const background: Promise<unknown>[] = [];
  const app = createLocalApp(
    { botToken: '4242:SECRET', port: 0, baseUrl: ORIGIN, databasePath: ':memory:', linkTtlMinutes: 5 },
    { ceremonies: createFakeCeremonies() },
  );
  const call = (path: string, { method = 'GET', json, bytes, headers = {} }: Init = {}) =>
    app.handleRequest(
      new Request(`${ORIGIN}${path}`, {
        method,
        headers: {
          ...(json === undefined ? {} : { 'content-type': 'application/json' }),
          ...(bytes === undefined ? {} : { 'content-type': 'application/octet-stream' }),
          ...headers,
        },
        ...(json === undefined ? {} : { body: JSON.stringify(json) }),
        ...(bytes === undefined ? {} : { body: bytes }),
      }),
      (work) => background.push(work),
    );
  const settle = () => Promise.all(background);
  return { app, call, settle };
};

const bytes = (length: number, fill: number): Uint8Array<ArrayBuffer> => new Uint8Array(length).fill(fill);

type Ticket = { readonly uploadId: string; readonly partSize: number; readonly partCount: number; readonly expiresAt: number };

const dropFile = async (call: ReturnType<typeof build>['call'], name: string, size: number, ttlMinutes = 15): Promise<Ticket> => {
  const response = await call('/api/file-drops', { method: 'POST', json: { name, size, contentType: 'text/html', ttlMinutes } });
  expect(response.status).toBe(201);
  return response.json();
};

describe('file uploads (secret-files US-1)', () => {
  test('a dropped file goes up in parts and comes down once under its own name (AC-1.2, AC-1.5, AC-1.6, AC-2.2, AC-2.3)', async () => {
    const { call, settle } = build();
    const size = FILE_PART_BYTES + 5;
    const ticket = await dropFile(call, 'résumé.html', size);
    expect(ticket).toEqual({ uploadId: expect.stringMatching(/^[0-9a-f]{64}$/), partSize: FILE_PART_BYTES, partCount: 2, expiresAt: expect.any(Number) });
    const part = (n: number, body: Uint8Array<ArrayBuffer>) => call(`/api/uploads/${ticket.uploadId}/parts/${String(n)}`, { method: 'PUT', bytes: body });
    expect((await part(1, bytes(FILE_PART_BYTES, 1))).status).toBe(204);
    expect((await part(2, bytes(5, 2))).status).toBe(204);
    const completed = await call(`/api/uploads/${ticket.uploadId}/complete`, { method: 'POST' });
    expect(completed.status).toBe(201);
    const link = await completed.json();
    expect(link).toEqual({ url: expect.stringMatching(/^https:\/\/app\.test\/s\/[0-9a-f]{64}$/), curl: `curl -X POST -OJ ${link.url}`, ttlMinutes: 15 });

    const path = new URL(link.url).pathname;
    const info = await call(path, { headers: { accept: 'application/json' } });
    expect(await info.json()).toEqual({ kind: 'file', name: 'résumé.html', size });
    const page = await call(path, { headers: { accept: 'text/html' } });
    const html = await page.text();
    expect(html).toContain('résumé.html');
    expect(html).toContain('8.0 MiB');
    expect(html).toContain('Download file');

    const opened = await call(path, { method: 'POST' });
    expect(opened.status).toBe(200);
    expect(opened.headers.get('content-type')).toBe('application/octet-stream');
    expect(opened.headers.get('x-content-type-options')).toBe('nosniff');
    expect(opened.headers.get('content-disposition')).toBe(`attachment; filename="r_sum_.html"; filename*=UTF-8''r%C3%A9sum%C3%A9.html`);
    const content = new Uint8Array(await opened.arrayBuffer());
    expect(content.length).toBe(size);
    expect(content[size - 1]).toBe(2);
    await settle();
    expect((await call(path, { method: 'POST' })).status).toBe(410);
    expect((await call(path, { headers: { accept: 'application/json' } })).status).toBe(410);
  });

  test('a signed-in upload uses the account lifetime (AC-1.1)', async () => {
    const { app, call } = build();
    const { token } = await app.tokens.create(ACCOUNT, 'cli');
    const auth = { authorization: `Bearer ${token}` };
    await call('/api/settings', { method: 'PUT', json: { linkTtlMinutes: 60 }, headers: auth });
    const begun = await call('/api/files', { method: 'POST', json: { name: 'a.txt', size: 3 }, headers: auth });
    expect(begun.status).toBe(201);
    const { uploadId } = await begun.json();
    await call(`/api/uploads/${uploadId}/parts/1`, { method: 'PUT', bytes: bytes(3, 9) });
    expect(await (await call(`/api/uploads/${uploadId}/complete`, { method: 'POST' })).json()).toMatchObject({ ttlMinutes: 60 });
    expect((await call('/api/files', { method: 'POST', json: { name: 'a.txt', size: 3 } })).status).toBe(401);
  });

  test('bad sizes, names, lifetimes, parts and unknown uploads are refused (AC-1.3–1.5, AC-1.8)', async () => {
    const { call } = build();
    const statuses = await Promise.all(
      [
        { name: 'a', size: 0, ttlMinutes: 5 },
        { name: 'a', size: 104_857_601, ttlMinutes: 5 },
        { name: 'a/b', size: 1, ttlMinutes: 5 },
        { name: '', size: 1, ttlMinutes: 5 },
        { name: 'a', size: 1, ttlMinutes: 1441 },
        { name: 'a', size: '1', ttlMinutes: 5 },
      ].map((json) => call('/api/file-drops', { method: 'POST', json })),
    );
    expect(statuses.map((response) => response.status)).toEqual([400, 400, 400, 400, 400, 400]);
    const tooBig = await call('/api/file-drops', { method: 'POST', json: { name: 'a', size: 104_857_601, ttlMinutes: 5 } });
    expect((await tooBig.json()).error).toContain('100 MiB');

    const ticket = await dropFile(call, 'a.bin', 10);
    expect((await call(`/api/uploads/${ticket.uploadId}/parts/1`, { method: 'PUT', bytes: bytes(9, 1) })).status).toBe(400);
    expect((await call(`/api/uploads/${ticket.uploadId}/parts/2`, { method: 'PUT', bytes: bytes(10, 1) })).status).toBe(400);
    expect((await call(`/api/uploads/${ticket.uploadId}/complete`, { method: 'POST' })).status).toBe(400);
    expect((await call('/api/uploads/unknown/parts/1', { method: 'PUT', bytes: bytes(1, 1) })).status).toBe(404);
    expect((await call('/api/uploads/unknown/complete', { method: 'POST' })).status).toBe(404);
    expect((await call(`/api/uploads/${ticket.uploadId}`, { method: 'DELETE' })).status).toBe(204);
    expect((await call(`/api/uploads/${ticket.uploadId}/parts/1`, { method: 'PUT', bytes: bytes(10, 1) })).status).toBe(404);
    expect((await call(`/api/uploads/${ticket.uploadId}`, { method: 'DELETE' })).status).toBe(404);
  });

  test('a part announced larger than the part size is refused before it is read (AC-1.5)', async () => {
    const { call } = build();
    const ticket = await dropFile(call, 'a.bin', 10);
    const response = await call(`/api/uploads/${ticket.uploadId}/parts/1`, {
      method: 'PUT',
      bytes: bytes(10, 1),
      headers: { 'content-length': String(FILE_PART_BYTES + 1) },
    });
    expect(response.status).toBe(413);
  });

  test('file drops share the drop rate limit; parts are not limited (AC-1.2)', async () => {
    const { call } = build();
    const headers = { 'cf-connecting-ip': '10.0.0.77' };
    const responses = await Promise.all(
      Array.from({ length: 31 }, () => call('/api/file-drops', { method: 'POST', json: { name: 'a', size: 1, ttlMinutes: 1 }, headers })),
    );
    expect(responses.map((response) => response.status).filter((status) => status === 429)).toHaveLength(1);
  });

  test('a cross-site page carrying the session cookie cannot drive an upload (http-api AC-2.3)', async () => {
    const { call } = build();
    const ticket = await dropFile(call, 'a.bin', 1);
    const response = await call(`/api/uploads/${ticket.uploadId}/parts/1`, {
      method: 'PUT',
      bytes: bytes(1, 1),
      headers: { cookie: 'session=whatever', origin: 'https://evil.test' },
    });
    expect(response.status).toBe(403);
  });
});

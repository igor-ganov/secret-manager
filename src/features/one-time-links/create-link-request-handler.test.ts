import { describe, expect, test } from 'bun:test';
import { createLinkRequestHandler } from './create-link-request-handler.ts';
import { createOneTimeLinkStore } from './create-one-time-link-store.ts';
import { createFileLinkStore } from '../secret-files/create-file-link-store.ts';
import { createFileSharingService } from '../secret-files/create-file-sharing-service.ts';
import { createMemoryFileObjectStore } from '../secret-files/create-memory-file-object-store.ts';

const createFixture = () => {
  let tokenCounter = 0;
  const createToken = () => `token-${(tokenCounter += 1)}`;
  const now = () => 0;
  const links = createOneTimeLinkStore({ ttlMs: 5 * 60 * 1000, now, createToken });
  const objects = createMemoryFileObjectStore({ createToken });
  const files = createFileSharingService({
    objects,
    links: createFileLinkStore({ now, createToken }),
    ttlMinutesFor: async () => 5,
    buildLinkUrl: (token) => `http://localhost/s/${token}`,
    createToken,
    now,
  });
  const background: Promise<unknown>[] = [];
  const handler = createLinkRequestHandler({ links, files });
  const handle = (request: Request) => handler(request, (work) => background.push(work));
  /* A stored file of `content`, returning its token. */
  const shareFile = async (name: string, content: string): Promise<string> => {
    const link = await files.shareBytes(1, { name, contentType: 'text/html' }, new TextEncoder().encode(content));
    return link.ok ? (link.value.url.split('/').pop() ?? '') : '';
  };
  return { links, handle, shareFile, objects, settle: () => Promise.all(background) };
};

const HTML_ACCEPT = { accept: 'text/html,application/xhtml+xml' };

const requestFor = (
  path: string,
  method = 'GET',
  headers?: Record<string, string>,
): Request =>
  new Request(`http://localhost${path}`, headers ? { method, headers } : { method });

describe('createLinkRequestHandler', () => {
  test('GET shows a confirmation page without consuming the secret', async () => {
    const { links, handle } = createFixture();
    const token = await links.issue('top-secret');

    const first = await handle(requestFor(`/s/${token}`));
    expect(first.status).toBe(200);
    const body = await first.text();
    expect(body).not.toContain('top-secret');
    expect(body).toContain('method="post"');

    const second = await handle(requestFor(`/s/${token}`));
    expect(second.status).toBe(200);
    expect(await second.text()).not.toContain('top-secret');
  });

  test('POST serves the secret exactly once, then responds 410', async () => {
    const { links, handle } = createFixture();
    const token = await links.issue('top-secret');

    const first = await handle(requestFor(`/s/${token}`, 'POST'));
    expect(first.status).toBe(200);
    expect(await first.text()).toContain('top-secret');

    const second = await handle(requestFor(`/s/${token}`, 'POST'));
    expect(second.status).toBe(410);
    expect(await second.text()).not.toContain('top-secret');
  });

  test('POST from a script returns the bare value as text/plain', async () => {
    const { links, handle } = createFixture();
    const token = await links.issue('top-secret');

    const response = await handle(requestFor(`/s/${token}`, 'POST'));
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).toBe('top-secret\n');
  });

  test('POST from a browser returns the styled HTML secret page', async () => {
    const { links, handle } = createFixture();
    const token = await links.issue('top-secret');

    const response = await handle(requestFor(`/s/${token}`, 'POST', HTML_ACCEPT));
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    const body = await response.text();
    expect(body).toContain('<pre>top-secret</pre>');
  });

  test('a consumed link responds 410 as text/plain to a script', async () => {
    const { links, handle } = createFixture();
    const token = await links.issue('top-secret');
    await handle(requestFor(`/s/${token}`, 'POST'));

    const response = await handle(requestFor(`/s/${token}`, 'POST'));
    expect(response.status).toBe(410);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  });

  test('GET responds 410 after the secret has been consumed', async () => {
    const { links, handle } = createFixture();
    const token = await links.issue('top-secret');
    await handle(requestFor(`/s/${token}`, 'POST'));
    expect((await handle(requestFor(`/s/${token}`))).status).toBe(410);
  });

  test('responds 410 for an unknown token', async () => {
    const { handle } = createFixture();
    expect((await handle(requestFor('/s/unknown'))).status).toBe(410);
    expect((await handle(requestFor('/s/unknown', 'POST'))).status).toBe(410);
  });

  test('responds 404 outside the link path', async () => {
    const { handle } = createFixture();
    expect((await handle(requestFor('/'))).status).toBe(404);
    expect((await handle(requestFor('/anything'))).status).toBe(404);
  });

  test('rejects methods other than GET and POST', async () => {
    const { links, handle } = createFixture();
    const token = await links.issue('secret');
    const response = await handle(requestFor(`/s/${token}`, 'DELETE'));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, POST');
    expect((await handle(requestFor(`/s/${token}`, 'POST'))).status).toBe(200);
  });

  test('escapes html in the secret value', async () => {
    const { links, handle } = createFixture();
    const token = await links.issue('<script>alert(1)</script>');
    const response = await handle(requestFor(`/s/${token}`, 'POST', HTML_ACCEPT));
    const body = await response.text();
    expect(body).not.toContain('<script>alert(1)</script>');
    expect(body).toContain('&lt;script&gt;');
  });

  test('sets no-store and noindex headers on both pages', async () => {
    const { links, handle } = createFixture();
    const token = await links.issue('secret');
    const confirm = await handle(requestFor(`/s/${token}`));
    expect(confirm.headers.get('cache-control')).toBe('no-store');
    expect(confirm.headers.get('x-robots-tag')).toContain('noindex');
    const secret = await handle(requestFor(`/s/${token}`, 'POST'));
    expect(secret.headers.get('cache-control')).toBe('no-store');
    expect(secret.headers.get('x-robots-tag')).toContain('noindex');
  });

  test('a program can ask what a live link holds without consuming it (secret-files AC-2.4)', async () => {
    const { links, handle } = createFixture();
    const token = await links.issue('top-secret');
    const json = { accept: 'application/json' };
    const info = await handle(requestFor(`/s/${token}`, 'GET', json));
    expect(info.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await info.json()).toEqual({ kind: 'text' });
    expect(await (await handle(requestFor(`/s/${token}`, 'POST'))).text()).toBe('top-secret\n');
    expect((await handle(requestFor(`/s/${token}`, 'GET', json))).status).toBe(410);
  });
});

describe('createLinkRequestHandler with files (secret-files US-2)', () => {
  test('the confirm page names the file escaped and posts to download it (AC-2.1)', async () => {
    const { handle, shareFile } = createFixture();
    const token = await shareFile('<b>x<i>.txt', 'hello');
    const page = await handle(requestFor(`/s/${token}`, 'GET', HTML_ACCEPT));
    expect(page.status).toBe(200);
    const body = await page.text();
    expect(body).toContain('&lt;b&gt;x&lt;i&gt;.txt');
    expect(body).not.toContain('<b>x<i>');
    expect(body).toContain('5 B');
    expect(body).toContain('method="post"');
    expect(body).toContain('Download file');
  });

  test('a browser POST downloads the file as an attachment, then the link is gone (AC-2.2, AC-2.5)', async () => {
    const { handle, shareFile, settle, objects } = createFixture();
    const token = await shareFile('page.html', '<script>alert(1)</script>');
    const response = await handle(requestFor(`/s/${token}`, 'POST', HTML_ACCEPT));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(await response.text()).toBe('<script>alert(1)</script>');
    await settle();
    expect(objects.size()).toBe(0);
    expect((await handle(requestFor(`/s/${token}`, 'POST', HTML_ACCEPT))).status).toBe(410);
  });

  test('a download the client abandons still deletes the file (AC-2.3)', async () => {
    const { handle, shareFile, settle, objects } = createFixture();
    const token = await shareFile('a.bin', 'abc');
    const response = await handle(requestFor(`/s/${token}`, 'POST'));
    await response.body?.cancel();
    await settle();
    expect(objects.size()).toBe(0);
  });
});

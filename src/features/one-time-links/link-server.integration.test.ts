import { afterAll, describe, expect, test } from 'bun:test';
import { createLinkRequestHandler, LINK_PATH_PREFIX } from './create-link-request-handler.ts';
import { createOneTimeLinkStore } from './create-one-time-link-store.ts';
import { createToken } from './create-token.ts';

const links = createOneTimeLinkStore({
  ttlMs: 5 * 60 * 1000,
  now: Date.now,
  createToken,
});

const server = Bun.serve({
  port: 0,
  fetch: createLinkRequestHandler(links),
});

afterAll(() => server.stop(true));

const urlFor = (token: string): string => `${server.url.origin}${LINK_PATH_PREFIX}${token}`;

describe('link server over real http', () => {
  test('survives a link-preview GET, then serves the secret once via POST', async () => {
    const token = await links.issue('integration-secret');

    const crawlerPreview = await fetch(urlFor(token));
    expect(crawlerPreview.status).toBe(200);
    expect(await crawlerPreview.text()).not.toContain('integration-secret');

    const reveal = await fetch(urlFor(token), { method: 'POST' });
    expect(reveal.status).toBe(200);
    expect(await reveal.text()).toContain('integration-secret');

    const repeat = await fetch(urlFor(token), { method: 'POST' });
    expect(repeat.status).toBe(410);
    expect(await repeat.text()).not.toContain('integration-secret');
  });

  test('issues unique unguessable tokens', async () => {
    const first = await links.issue('a');
    const second = await links.issue('a');
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(64);
  });
});

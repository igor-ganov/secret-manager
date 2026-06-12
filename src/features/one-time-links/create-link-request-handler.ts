import type { OneTimeLinkStore } from './one-time-link-store.ts';
import { renderConfirmPage, renderGonePage, renderSecretPage } from './render-pages.ts';

export const LINK_PATH_PREFIX = '/s/';

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
} as const;

const htmlResponse = (body: string, status: number): Response =>
  new Response(body, { status, headers: HTML_HEADERS });

const gone = (): Response => htmlResponse(renderGonePage(), 410);

/* GET only shows a confirmation page, so link-preview crawlers and safe-link
   scanners cannot burn the secret; it is consumed exclusively via POST. */
const handleConfirm = async (links: OneTimeLinkStore, token: string): Promise<Response> =>
  (await links.peek(token)) ? htmlResponse(renderConfirmPage(), 200) : gone();

const handleReveal = async (links: OneTimeLinkStore, token: string): Promise<Response> => {
  const value = await links.consume(token);
  return value === undefined ? gone() : htmlResponse(renderSecretPage(value), 200);
};

export const createLinkRequestHandler =
  (links: OneTimeLinkStore) =>
  async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(LINK_PATH_PREFIX)) {
      return new Response('Not found', { status: 404 });
    }
    const token = url.pathname.slice(LINK_PATH_PREFIX.length);
    switch (request.method) {
      case 'GET':
        return handleConfirm(links, token);
      case 'POST':
        return handleReveal(links, token);
      default:
        return new Response('Method not allowed', {
          status: 405,
          headers: { allow: 'GET, POST' },
        });
    }
  };

import type { OneTimeLinkStore } from './one-time-link-store.ts';
import { renderConfirmPage, renderGonePage, renderSecretPage } from './render-pages.ts';

export const LINK_PATH_PREFIX = '/s/';

const SECURITY_HEADERS = {
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
} as const;

const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8', ...SECURITY_HEADERS } as const;
const TEXT_HEADERS = { 'content-type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS } as const;

const htmlResponse = (body: string, status: number): Response =>
  new Response(body, { status, headers: HTML_HEADERS });

const textResponse = (body: string, status: number): Response =>
  new Response(body, { status, headers: TEXT_HEADERS });

/* Browsers send an `Accept` header that includes `text/html`; curl and scripts
   send a wildcard or nothing. The styled page is for the eye, the bare value is
   for the pipe, so one url serves both: `secret=$(curl -X POST …)` is the value. */
const wantsHtml = (request: Request): boolean =>
  (request.headers.get('accept') ?? '').includes('text/html');

const gone = (request: Request): Response =>
  wantsHtml(request)
    ? htmlResponse(renderGonePage(), 410)
    : textResponse('This link has already been used or has expired.\n', 410);

/* GET only shows a confirmation page, so link-preview crawlers and safe-link
   scanners cannot burn the secret; it is consumed exclusively via POST. */
const handleConfirm = async (
  links: OneTimeLinkStore,
  token: string,
  request: Request,
): Promise<Response> =>
  (await links.peek(token)) ? htmlResponse(renderConfirmPage(), 200) : gone(request);

const handleReveal = async (
  links: OneTimeLinkStore,
  token: string,
  request: Request,
): Promise<Response> => {
  const value = await links.consume(token);
  if (value === undefined) {
    return gone(request);
  }
  return wantsHtml(request)
    ? htmlResponse(renderSecretPage(value), 200)
    : textResponse(`${value}\n`, 200);
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
        return handleConfirm(links, token, request);
      case 'POST':
        return handleReveal(links, token, request);
      default:
        return new Response('Method not allowed', {
          status: 405,
          headers: { allow: 'GET, POST' },
        });
    }
  };

import type { LinkInfoResponse } from '../http-api/api-types.ts';
import { attachmentDisposition } from '../secret-files/content-disposition.ts';
import type { FileSharingService, OpenedFile } from '../secret-files/file-sharing-service.ts';
import type { OneTimeLinkStore } from './one-time-link-store.ts';
import { renderConfirmPage, renderFileConfirmPage, renderGonePage, renderSecretPage } from './render-pages.ts';

export const LINK_PATH_PREFIX = '/s/';

/* Work that must finish after the response is sent: the Worker's
   ctx.waitUntil, or a plain fire-and-forget locally. */
export type Background = (work: Promise<unknown>) => void;

export type LinkHandlerDependencies = {
  readonly links: OneTimeLinkStore;
  readonly files: Pick<FileSharingService, 'peek' | 'open'>;
};

const SECURITY_HEADERS = {
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
} as const;

const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8', ...SECURITY_HEADERS } as const;
const TEXT_HEADERS = { 'content-type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS } as const;
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', ...SECURITY_HEADERS } as const;

const htmlResponse = (body: string, status: number): Response =>
  new Response(body, { status, headers: HTML_HEADERS });

const textResponse = (body: string, status: number): Response =>
  new Response(body, { status, headers: TEXT_HEADERS });

const jsonResponse = (body: LinkInfoResponse | { readonly error: string }, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

const GONE_TEXT = 'This link has already been used or has expired.';

/* Browsers send an `Accept` header that includes `text/html`; curl and scripts
   send a wildcard or nothing. The styled page is for the eye, the bare value is
   for the pipe, so one url serves both: `secret=$(curl -X POST …)` is the value.
   A program asking for JSON learns what the link holds (secret-files AC-2.4). */
const acceptOf = (request: Request): string => request.headers.get('accept') ?? '';
const wantsHtml = (request: Request): boolean => acceptOf(request).includes('text/html');
const wantsJson = (request: Request): boolean => acceptOf(request).includes('application/json');

const gone = (request: Request): Response => {
  if (wantsJson(request)) {
    return jsonResponse({ error: GONE_TEXT }, 410);
  }
  return wantsHtml(request) ? htmlResponse(renderGonePage(), 410) : textResponse(`${GONE_TEXT}\n`, 410);
};

/* The file streams through an identity transform; when the copy ends — or the
   client goes away — the stored object is deleted (secret-files AC-2.3). */
const fileResponse = (file: OpenedFile, background: Background): Response => {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  background(file.body.pipeTo(writable).catch(() => undefined).finally(file.dispose));
  return new Response(readable, {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      'content-type': 'application/octet-stream',
      'content-disposition': attachmentDisposition(file.name),
      'x-content-type-options': 'nosniff',
    },
  });
};

const ignoreFailure: Background = (work) => {
  work.catch((error: unknown) => console.error('Background work failed:', error));
};

/* GET only shows a confirmation page, so link-preview crawlers and safe-link
   scanners cannot burn the secret; it is consumed exclusively via POST. Text
   links are looked up first, then files. */
const handleConfirm = async ({ links, files }: LinkHandlerDependencies, token: string, request: Request): Promise<Response> => {
  if (await links.peek(token)) {
    return wantsJson(request) ? jsonResponse({ kind: 'text' }, 200) : htmlResponse(renderConfirmPage(), 200);
  }
  const file = await files.peek(token);
  if (file === undefined) {
    return gone(request);
  }
  return wantsJson(request)
    ? jsonResponse({ kind: 'file', name: file.name, size: file.size }, 200)
    : htmlResponse(renderFileConfirmPage(file), 200);
};

const handleReveal = async (
  { links, files }: LinkHandlerDependencies,
  token: string,
  request: Request,
  background: Background,
): Promise<Response> => {
  const value = await links.consume(token);
  if (value !== undefined) {
    return wantsHtml(request) ? htmlResponse(renderSecretPage(value), 200) : textResponse(`${value}\n`, 200);
  }
  const file = await files.open(token);
  return file === undefined ? gone(request) : fileResponse(file, background);
};

export const createLinkRequestHandler =
  (dependencies: LinkHandlerDependencies) =>
  async (request: Request, background: Background = ignoreFailure): Promise<Response> => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(LINK_PATH_PREFIX)) {
      return new Response('Not found', { status: 404 });
    }
    const token = url.pathname.slice(LINK_PATH_PREFIX.length);
    switch (request.method) {
      case 'GET':
        return handleConfirm(dependencies, token, request);
      case 'POST':
        return handleReveal(dependencies, token, request, background);
      default:
        return new Response('Method not allowed', {
          status: 405,
          headers: { allow: 'GET, POST' },
        });
    }
  };

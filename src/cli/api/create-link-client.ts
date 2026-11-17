import type { LinkInfoResponse } from '../../features/http-api/api-types.ts';
import { decodeLinkInfo } from '../../features/http-api/decoders/decode-files.ts';
import { readErrorMessage } from '../../features/http-api/read-error-message.ts';
import type { ApiResult } from './api-client.ts';
import type { FetchFn } from './create-api-client.ts';
import type { LinkClient, LinkPayload } from './link-client.ts';

const UNEXPECTED = 'Unexpected response from the server.';

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const unreachable = (url: string, error: unknown): ApiResult<never> => ({
  ok: false,
  error: { kind: 'unreachable', message: `Cannot reach ${new URL(url).origin}: ${error instanceof Error ? error.message : String(error)}` },
});

/* The link answers a dead token with 410 and a sentence (text or JSON). */
const rejected = async (response: Response): Promise<ApiResult<never>> => {
  const text = (await response.text()).trim();
  const parsed = parseJson(text);
  const message = parsed === undefined && text !== '' ? text : readErrorMessage(parsed, response.status);
  return { ok: false, error: { kind: 'rejected', message } };
};

const isText = (response: Response): boolean => (response.headers.get('content-type') ?? '').startsWith('text/plain');

const payloadOf = async (response: Response): Promise<LinkPayload> =>
  isText(response) ? { kind: 'text', value: (await response.text()).replace(/\r?\n$/, '') } : { kind: 'file', body: response.body ?? new ReadableStream() };

const withNetwork = async <T>(url: string, run: () => Promise<ApiResult<T>>): Promise<ApiResult<T>> => {
  try {
    return await run();
  } catch (error) {
    return unreachable(url, error);
  }
};

/* One-time links by their absolute url (secret-files AC-2.4, AC-5.2): a JSON
   GET tells what a link holds without consuming it; a POST opens it. */
export const createLinkClient = (fetchFn: FetchFn): LinkClient => ({
  peek: (url) =>
    withNetwork(url, async (): Promise<ApiResult<LinkInfoResponse>> => {
      const response = await fetchFn(url, { method: 'GET', headers: { accept: 'application/json' } });
      if (!response.ok) {
        return rejected(response);
      }
      const info = decodeLinkInfo(parseJson(await response.text()));
      return info === undefined ? { ok: false, error: { kind: 'rejected', message: UNEXPECTED } } : { ok: true, value: info };
    }),
  open: (url) =>
    withNetwork(url, async (): Promise<ApiResult<LinkPayload>> => {
      const response = await fetchFn(url, { method: 'POST' });
      return response.ok ? { ok: true, value: await payloadOf(response) } : rejected(response);
    }),
});

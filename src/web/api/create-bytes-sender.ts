import { decodeEmpty } from '../../features/http-api/decoders/decode-empty.ts';
import type { Result } from '../../features/result/result.ts';
import type { Bytes } from '../../features/secret-files/upload-in-parts.ts';
import type { FetchFn } from './create-json-requester.ts';
import { toResult } from './to-result.ts';

/* Raw-body requests (file parts); success carries no payload. */
export type BytesSender = (method: string, path: string, bytes: Bytes) => Promise<Result<true>>;

const NETWORK_ERROR: Result<true> = { ok: false, error: 'The connection to the server failed.' };

const parseBody = (text: string): unknown => JSON.parse(text || '{}');

/* A dropped connection is a failed part, not a crash: the upload retries it
   and aborts the session if it keeps failing. */
export const createBytesSender =
  (fetchFn: FetchFn): BytesSender =>
  async (method, path, bytes) =>
    fetchFn(path, { method, credentials: 'same-origin', headers: { 'content-type': 'application/octet-stream' }, body: bytes })
      .then(async (response) => toResult(response, decodeEmpty, parseBody(await response.text())))
      .catch(() => NETWORK_ERROR);

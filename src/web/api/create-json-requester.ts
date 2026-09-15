import { buildRequestInit } from './build-request-init.ts';
import type { Decoder } from '../../features/http-api/decoders/decoder.ts';
import { readErrorMessage } from '../../features/http-api/read-error-message.ts';
import type { Result } from '../../features/result/result.ts';

export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

export type JsonRequester = <T>(
  method: string,
  path: string,
  decode: Decoder<T>,
  body?: unknown,
) => Promise<Result<T>>;

const UNEXPECTED = 'Unexpected response from the server.';

const parseBody = (text: string): unknown => JSON.parse(text || '{}');

const decodeOk = <T>(decode: Decoder<T>, body: unknown): Result<T> => {
  const value = decode(body);
  switch (value) {
    case undefined:
      return { ok: false, error: UNEXPECTED };
    default:
      return { ok: true, value };
  }
};

const toResult = <T>(response: Response, decode: Decoder<T>, body: unknown): Result<T> => {
  switch (response.ok) {
    case true:
      return decodeOk(decode, body);
    case false:
      return { ok: false, error: readErrorMessage(body, response.status) };
  }
};

export const createJsonRequester =
  (fetchFn: FetchFn): JsonRequester =>
  async (method, path, decode, body) => {
    const response = await fetchFn(path, buildRequestInit(method, body));
    return toResult(response, decode, parseBody(await response.text()));
  };

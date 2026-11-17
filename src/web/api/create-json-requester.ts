import { buildRequestInit } from './build-request-init.ts';
import type { Decoder } from '../../features/http-api/decoders/decoder.ts';
import type { Result } from '../../features/result/result.ts';
import { toResult } from './to-result.ts';

export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

export type JsonRequester = <T>(
  method: string,
  path: string,
  decode: Decoder<T>,
  body?: unknown,
) => Promise<Result<T>>;

const parseBody = (text: string): unknown => JSON.parse(text || '{}');

export const createJsonRequester =
  (fetchFn: FetchFn): JsonRequester =>
  async (method, path, decode, body) => {
    const response = await fetchFn(path, buildRequestInit(method, body));
    return toResult(response, decode, parseBody(await response.text()));
  };

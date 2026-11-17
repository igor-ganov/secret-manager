import type { Decoder } from '../../features/http-api/decoders/decoder.ts';
import { readErrorMessage } from '../../features/http-api/read-error-message.ts';
import type { Result } from '../../features/result/result.ts';

const UNEXPECTED = 'Unexpected response from the server.';

const decodeOk = <T>(decode: Decoder<T>, body: unknown): Result<T> => {
  const value = decode(body);
  switch (value) {
    case undefined:
      return { ok: false, error: UNEXPECTED };
    default:
      return { ok: true, value };
  }
};

/* A parsed response as a Result: decoded on success, the server's message
   otherwise. Shared by the JSON requester and the bytes sender. */
export const toResult = <T>(response: Response, decode: Decoder<T>, body: unknown): Result<T> => {
  switch (response.ok) {
    case true:
      return decodeOk(decode, body);
    case false:
      return { ok: false, error: readErrorMessage(body, response.status) };
  }
};

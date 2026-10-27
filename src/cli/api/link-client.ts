import type { LinkInfoResponse } from '../../features/http-api/api-types.ts';
import type { ApiResult } from './api-client.ts';

/* What opening a link yields: a text value (the trailing newline the server
   adds for the pipe is removed) or the file as a stream. */
export type LinkPayload =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'file'; readonly body: ReadableStream<Uint8Array> };

/* One-time links by their absolute url, from any server (secret-files AC-2.4,
   AC-5.2): `peek` never consumes, `open` does. */
export type LinkClient = {
  readonly peek: (url: string) => Promise<ApiResult<LinkInfoResponse>>;
  readonly open: (url: string) => Promise<ApiResult<LinkPayload>>;
};

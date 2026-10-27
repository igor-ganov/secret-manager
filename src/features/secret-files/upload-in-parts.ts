import type { IssuedLinkResponse, UploadTicketResponse } from '../http-api/api-types.ts';
import type { Result } from '../result/result.ts';

/* Bytes backed by a plain ArrayBuffer: what fetch accepts as a body. */
export type Bytes = Uint8Array<ArrayBuffer>;

/* The four calls of a chunked upload, as each client makes them (fetch from
   the site, the utility or the MCP server). `E` is that client's error. */
export type UploadTransport<E> = {
  readonly begin: () => Promise<Result<UploadTicketResponse, E>>;
  readonly putPart: (uploadId: string, partNumber: number, bytes: Bytes) => Promise<Result<true, E>>;
  readonly complete: (uploadId: string) => Promise<Result<IssuedLinkResponse, E>>;
  readonly abort: (uploadId: string) => Promise<unknown>;
};

/* Bytes [start, end) of the file being uploaded. */
export type ReadRange = (start: number, end: number) => Promise<Bytes>;

const ATTEMPTS_PER_PART = 3;

const putWithRetry = async <E>(
  transport: UploadTransport<E>,
  uploadId: string,
  partNumber: number,
  bytes: Bytes,
  attempt = 1,
): Promise<Result<true, E>> => {
  const sent = await transport.putPart(uploadId, partNumber, bytes);
  return sent.ok || attempt >= ATTEMPTS_PER_PART ? sent : putWithRetry(transport, uploadId, partNumber, bytes, attempt + 1);
};

const sendParts = async <E>(
  transport: UploadTransport<E>,
  ticket: UploadTicketResponse,
  readRange: ReadRange,
  size: number,
  onProgress: (sentBytes: number) => void,
): Promise<Result<true, E>> => {
  for (let index = 0; index < ticket.partCount; index += 1) {
    const start = index * ticket.partSize;
    const end = Math.min(size, start + ticket.partSize);
    const sent = await putWithRetry(transport, ticket.uploadId, index + 1, await readRange(start, end));
    if (!sent.ok) {
      return sent;
    }
    onProgress(end);
  }
  return { ok: true, value: true };
};

/* The one upload algorithm (secret-files design §6): begin, parts in order
   (each retried), complete. Any failure aborts the session on the server so
   no half upload lingers, and comes back as the client's own error. */
export const uploadInParts = async <E>(
  transport: UploadTransport<E>,
  readRange: ReadRange,
  size: number,
  onProgress: (sentBytes: number) => void,
): Promise<Result<IssuedLinkResponse, E>> => {
  const begun = await transport.begin();
  if (!begun.ok) {
    return begun;
  }
  const ticket = begun.value;
  onProgress(0);
  const sent = await sendParts(transport, ticket, readRange, size, onProgress);
  const completed = sent.ok ? await transport.complete(ticket.uploadId) : sent;
  if (!completed.ok) {
    await transport.abort(ticket.uploadId);
  }
  return completed;
};

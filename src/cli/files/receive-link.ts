import type { LinkInfoResponse } from '../../features/http-api/api-types.ts';
import type { Result } from '../../features/result/result.ts';
import type { LinkClient, LinkPayload } from '../api/link-client.ts';
import { failureOutcome } from '../commands/to-outcome.ts';
import type { LocalFiles } from '../io/local-files.ts';
import { EXIT, failed, type Outcome } from '../outcome.ts';

/* What landed on disk; never the content itself (secret-files AC-6.2). */
export type ReceivedLink = {
  readonly path: string;
  readonly kind: LinkInfoResponse['kind'];
  readonly name: string;
  readonly sizeBytes: number;
};

export type LinkReceiver = { readonly files: LocalFiles; readonly links: LinkClient };

const CUT_SHORT = 'The download was cut short; the link is used up. Ask for a new one.';

const bodyOf = (payload: LinkPayload): ReadableStream<Uint8Array> =>
  payload.kind === 'file' ? payload.body : (new Response(payload.value).body ?? new ReadableStream());

const nameOf = (info: LinkInfoResponse, path: string): string => (info.kind === 'file' ? info.name : (path.split(/[\\/]/).pop() ?? path));

/* Opens the link (it is used up from here on) and streams it into `path`. A
   file that arrives shorter than announced is removed, not left half. */
export const receiveLink = async ({ files, links }: LinkReceiver, url: string, info: LinkInfoResponse, path: string): Promise<Result<ReceivedLink, Outcome>> => {
  const opened = await links.open(url);
  if (!opened.ok) {
    return { ok: false, error: failureOutcome(opened.error) };
  }
  const written = await files.write(path, bodyOf(opened.value));
  if (info.kind === 'file' && written !== info.size) {
    await files.remove(path);
    return { ok: false, error: failed(CUT_SHORT, EXIT.rejected) };
  }
  return { ok: true, value: { path, kind: info.kind, name: nameOf(info, path), sizeBytes: written } };
};

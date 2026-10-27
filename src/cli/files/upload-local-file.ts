import type { IssuedLinkResponse, UploadTicketResponse } from '../../features/http-api/api-types.ts';
import type { Result } from '../../features/result/result.ts';
import { isValidFileSize } from '../../features/secret-files/file-limits.ts';
import { uploadInParts } from '../../features/secret-files/upload-in-parts.ts';
import type { ApiResult, PublicClient } from '../api/api-client.ts';
import { failureOutcome } from '../commands/to-outcome.ts';
import type { LocalFile, LocalFiles } from '../io/local-files.ts';
import { EXIT, failed, type Outcome } from '../outcome.ts';

export type UploadedLocalFile = { readonly link: IssuedLinkResponse; readonly file: LocalFile };

export type LocalUpload = {
  readonly files: LocalFiles;
  /* Opens the session: on the account (`share --file`) or as a drop (MCP). */
  readonly begin: (file: LocalFile) => Promise<ApiResult<UploadTicketResponse>>;
  readonly parts: Pick<PublicClient, 'putPart' | 'completeUpload' | 'abortUpload'>;
  readonly onProgress: (file: LocalFile, sentBytes: number) => void;
};

const refuse = (message: string): Result<never, Outcome> => ({ ok: false, error: failed(message, EXIT.usage) });

/* A local file becomes a one-time link (secret-files AC-5.1, AC-6.1): checked
   on disk first (AC-5.5), then sent through the shared chunked upload. */
export const uploadLocalFile = async ({ files, begin, parts, onProgress }: LocalUpload, path: string): Promise<Result<UploadedLocalFile, Outcome>> => {
  const file = await files.stat(path);
  if (file === undefined) {
    return refuse(`No such file: ${path}`);
  }
  if (!isValidFileSize(file.size)) {
    return refuse(file.size === 0 ? `${path} is empty.` : `${path} is larger than 100 MiB.`);
  }
  const uploaded = await uploadInParts(
    { begin: () => begin(file), putPart: parts.putPart, complete: parts.completeUpload, abort: parts.abortUpload },
    (start, end) => files.readRange(path, start, end),
    file.size,
    (sent) => onProgress(file, sent),
  );
  return uploaded.ok ? { ok: true, value: { link: uploaded.value, file } } : { ok: false, error: failureOutcome(uploaded.error) };
};

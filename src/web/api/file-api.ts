import type { IssuedLinkResponse, UploadTicketResponse } from '../../features/http-api/api-types.ts';
import type { Result } from '../../features/result/result.ts';
import type { Bytes } from '../../features/secret-files/upload-in-parts.ts';

/* The chunked upload of a secret file (secret-files US-1). */
export type FileApi = {
  /* Signed in: the link honours the account's lifetime. */
  readonly beginFile: (name: string, size: number, contentType: string) => Promise<Result<UploadTicketResponse>>;
  /* Anonymous: the link lives `ttlMinutes`. */
  readonly dropFile: (name: string, size: number, contentType: string, ttlMinutes: number) => Promise<Result<UploadTicketResponse>>;
  readonly putPart: (uploadId: string, partNumber: number, bytes: Bytes) => Promise<Result<true>>;
  readonly completeUpload: (uploadId: string) => Promise<Result<IssuedLinkResponse>>;
  readonly abortUpload: (uploadId: string) => Promise<Result<true>>;
};

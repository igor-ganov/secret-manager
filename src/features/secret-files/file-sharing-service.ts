import type { Result } from '../result/result.ts';
import type { IssuedLink } from '../sharing/sharing-service.ts';

/* Who the link is for: an account (its lifetime setting applies) or nobody
   in particular (a drop carries its own lifetime). */
export type FileOwner =
  | { readonly kind: 'user'; readonly userId: number }
  | { readonly kind: 'drop'; readonly ttlMinutes: number };

export type FileUploadRequest = {
  readonly name: string;
  readonly size: number;
  readonly contentType: string;
};

export type UploadTicket = {
  readonly uploadId: string;
  readonly partSize: number;
  readonly partCount: number;
  readonly expiresAt: number;
};

/* `missing` is an unknown, finished or expired upload (404); `invalid` is a
   request the client can fix (400). */
export type FileFailure = { readonly kind: 'invalid'; readonly message: string } | { readonly kind: 'missing' };

export type FileResult<T> = Result<T, FileFailure>;

export type FileDescriptor = {
  readonly name: string;
  readonly size: number;
  readonly contentType: string;
};

/* A claimed link: the body streams the file once; `dispose` deletes it and
   must run when the stream is done, whatever its outcome. */
export type OpenedFile = FileDescriptor & {
  readonly body: ReadableStream<Uint8Array>;
  readonly dispose: () => Promise<void>;
};

/* Application service for secret files, shared by the HTTP API, the link
   handler, the bot and the scheduled sweep. */
export type FileSharingService = {
  readonly begin: (owner: FileOwner, request: FileUploadRequest) => Promise<FileResult<UploadTicket>>;
  readonly putPart: (uploadId: string, partNumber: number, bytes: Uint8Array) => Promise<FileResult<true>>;
  readonly complete: (uploadId: string) => Promise<FileResult<IssuedLink>>;
  /* True when a live session was aborted. */
  readonly abort: (uploadId: string) => Promise<boolean>;
  readonly peek: (token: string) => Promise<FileDescriptor | undefined>;
  readonly open: (token: string) => Promise<OpenedFile | undefined>;
  /* Small files in one request, linked under the account's lifetime. */
  readonly shareBytes: (
    userId: number,
    file: Omit<FileUploadRequest, 'size'>,
    bytes: Uint8Array,
  ) => Promise<FileResult<IssuedLink>>;
  readonly sweep: () => Promise<void>;
};

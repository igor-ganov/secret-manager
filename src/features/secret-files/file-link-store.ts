import type { UploadedPart } from './file-object-store.ts';

/* What a one-time file link points to. */
export type StoredFile = {
  readonly objectKey: string;
  readonly name: string;
  readonly size: number;
  readonly contentType: string;
};

/* An upload in progress: `uploadId` is the client's capability, the rest
   ties it to the storage's multipart upload and the link it will become. */
export type UploadSession = StoredFile & {
  readonly uploadId: string;
  readonly multipartId: string;
  /* Lifetime of the link once the upload completes. */
  readonly ttlMinutes: number;
  /* Deadline of the session itself. */
  readonly expiresAt: number;
};

export type ExpiredFiles = {
  readonly objectKeys: readonly string[];
  readonly uploads: readonly Pick<UploadSession, 'objectKey' | 'multipartId'>[];
};

/* Metadata of upload sessions and one-time file links (D1 or memory). Every
   read ignores expired rows; `sweep` removes them and says what to delete. */
export type FileLinkStore = {
  readonly beginUpload: (session: UploadSession) => Promise<void>;
  readonly findUpload: (uploadId: string) => Promise<UploadSession | undefined>;
  readonly recordPart: (uploadId: string, part: UploadedPart) => Promise<void>;
  /* Recorded parts, ordered by part number. */
  readonly listParts: (uploadId: string) => Promise<readonly UploadedPart[]>;
  /* Removes a live session and its parts, once: a second call gets nothing. */
  readonly endUpload: (uploadId: string) => Promise<UploadSession | undefined>;
  readonly issue: (file: StoredFile, ttlMs: number) => Promise<string>;
  readonly peek: (token: string) => Promise<StoredFile | undefined>;
  /* Atomic read-and-destroy: one caller wins, also under concurrency. */
  readonly claim: (token: string) => Promise<StoredFile | undefined>;
  readonly sweep: () => Promise<ExpiredFiles>;
};

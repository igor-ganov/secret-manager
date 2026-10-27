export type UploadedPart = {
  readonly partNumber: number;
  readonly etag: string;
};

/* Blob storage with multipart upload: R2 in production, a Map locally. Keys
   are random values chosen by the service, never derived from file names. */
export type FileObjectStore = {
  /* Starts a multipart upload; resolves to the storage's own upload id. */
  readonly createMultipart: (key: string, contentType: string) => Promise<string>;
  readonly putPart: (key: string, multipartId: string, partNumber: number, bytes: Uint8Array) => Promise<UploadedPart>;
  readonly completeMultipart: (key: string, multipartId: string, parts: readonly UploadedPart[]) => Promise<void>;
  readonly abortMultipart: (key: string, multipartId: string) => Promise<void>;
  /* Single-request upload for small files (the bot's 20 MB). */
  readonly put: (key: string, bytes: Uint8Array, contentType: string) => Promise<void>;
  readonly open: (key: string) => Promise<ReadableStream<Uint8Array> | undefined>;
  readonly remove: (key: string) => Promise<void>;
};

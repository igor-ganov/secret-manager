/* Minimal structural types for the Cloudflare R2 binding, for the same reason
   as d1-types.ts: the workers type set conflicts with the bun one. Only what
   the file store calls is declared. */
export type R2UploadedPart = {
  readonly partNumber: number;
  readonly etag: string;
};

export type R2MultipartUpload = {
  readonly uploadId: string;
  readonly uploadPart: (partNumber: number, value: Uint8Array) => Promise<R2UploadedPart>;
  readonly complete: (parts: readonly R2UploadedPart[]) => Promise<unknown>;
  readonly abort: () => Promise<void>;
};

export type R2HttpMetadata = { readonly httpMetadata?: { readonly contentType?: string } };

/* `get` resolves to R2's "no object" marker or an object with a body. */
export type R2ObjectBody = { readonly body: ReadableStream<Uint8Array> };

export type R2Bucket = {
  readonly createMultipartUpload: (key: string, options?: R2HttpMetadata) => Promise<R2MultipartUpload>;
  readonly resumeMultipartUpload: (key: string, uploadId: string) => R2MultipartUpload;
  readonly put: (key: string, value: Uint8Array, options?: R2HttpMetadata) => Promise<unknown>;
  readonly get: (key: string) => Promise<R2ObjectBody | null>;
  readonly delete: (key: string) => Promise<void>;
};

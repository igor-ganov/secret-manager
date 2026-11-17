import type { R2Bucket } from '../cloudflare/r2-types.ts';
import type { FileObjectStore } from './file-object-store.ts';

/* R2 adapter (binding FILES, bucket secret-manager-files). Multipart uploads
   are resumed by id on every request, so no state lives in the isolate. */
export const createR2FileObjectStore = (bucket: R2Bucket): FileObjectStore => ({
  createMultipart: async (key, contentType) => (await bucket.createMultipartUpload(key, { httpMetadata: { contentType } })).uploadId,
  putPart: async (key, multipartId, partNumber, bytes) => {
    const { etag } = await bucket.resumeMultipartUpload(key, multipartId).uploadPart(partNumber, bytes);
    return { partNumber, etag };
  },
  completeMultipart: async (key, multipartId, parts) => {
    await bucket.resumeMultipartUpload(key, multipartId).complete(parts);
  },
  /* Aborting an upload R2 already forgot (lifecycle rule) is not an error. */
  abortMultipart: async (key, multipartId) => {
    await bucket
      .resumeMultipartUpload(key, multipartId)
      .abort()
      .catch(() => undefined);
  },
  put: async (key, bytes, contentType) => {
    await bucket.put(key, bytes, { httpMetadata: { contentType } });
  },
  open: async (key) => (await bucket.get(key))?.body,
  remove: (key) => bucket.delete(key),
});

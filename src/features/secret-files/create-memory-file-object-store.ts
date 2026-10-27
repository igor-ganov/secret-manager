import type { FileObjectStore, UploadedPart } from './file-object-store.ts';

export type MemoryFileObjectStore = FileObjectStore & {
  /* Stored objects and open uploads, for tests asserting nothing is left. */
  readonly size: () => number;
  readonly pendingUploads: () => number;
};

export type MemoryFileObjectStoreOptions = {
  readonly createToken: () => string;
};

type PendingUpload = { readonly key: string; readonly parts: Map<number, Uint8Array> };

const concat = (chunks: readonly Uint8Array[]): Uint8Array => {
  const joined = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  chunks.reduce((offset, chunk) => {
    joined.set(chunk, offset);
    return offset + chunk.length;
  }, 0);
  return joined;
};

const streamOf = (bytes: Uint8Array): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start: (controller) => {
      controller.enqueue(bytes);
      controller.close();
    },
  });

/* The R2 contract in a Map: parts are kept until completion, which joins
   them in the order given; aborting or completing ends the upload. */
export const createMemoryFileObjectStore = ({ createToken }: MemoryFileObjectStoreOptions): MemoryFileObjectStore => {
  const objects = new Map<string, Uint8Array>();
  const uploads = new Map<string, PendingUpload>();

  const pending = (key: string, multipartId: string): PendingUpload => {
    const upload = uploads.get(multipartId);
    if (upload === undefined || upload.key !== key) {
      throw new Error('No such multipart upload.');
    }
    return upload;
  };

  const completeMultipart = async (key: string, multipartId: string, parts: readonly UploadedPart[]): Promise<void> => {
    const upload = pending(key, multipartId);
    const chunks = parts.flatMap(({ partNumber }) => {
      const chunk = upload.parts.get(partNumber);
      return chunk === undefined ? [] : [chunk];
    });
    if (chunks.length !== parts.length) {
      throw new Error('A part is missing.');
    }
    objects.set(key, concat(chunks));
    uploads.delete(multipartId);
  };

  return {
    createMultipart: async (key) => {
      const multipartId = createToken();
      uploads.set(multipartId, { key, parts: new Map() });
      return multipartId;
    },
    putPart: async (key, multipartId, partNumber, bytes) => {
      pending(key, multipartId).parts.set(partNumber, bytes.slice());
      return { partNumber, etag: `etag-${String(partNumber)}` };
    },
    completeMultipart,
    abortMultipart: async (_key, multipartId) => {
      uploads.delete(multipartId);
    },
    put: async (key, bytes) => {
      objects.set(key, bytes.slice());
    },
    open: async (key) => {
      const bytes = objects.get(key);
      return bytes === undefined ? undefined : streamOf(bytes);
    },
    remove: async (key) => {
      objects.delete(key);
    },
    size: () => objects.size,
    pendingUploads: () => uploads.size,
  };
};

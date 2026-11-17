import type { Bytes } from '../../features/secret-files/upload-in-parts.ts';

export type LocalFile = {
  /* Base name, as the link will present it. */
  readonly name: string;
  readonly size: number;
  readonly contentType: string;
};

/* The file system as the utility and its MCP server need it (secret-files
   US-5, US-6); main.ts implements it with Bun, tests with a Map. */
export type LocalFiles = {
  /* Undefined for a missing path or anything that is not a regular file. */
  readonly stat: (path: string) => Promise<LocalFile | undefined>;
  /* Bytes [start, end) of the file. */
  readonly readRange: (path: string, start: number, end: number) => Promise<Bytes>;
  readonly exists: (path: string) => Promise<boolean>;
  /* Absolute path, relative ones taken from the working folder. */
  readonly resolve: (path: string) => string;
  /* Streams `body` into `path` (through a temporary file, so a cut download
     never leaves a half file under the real name); resolves to the bytes
     written. */
  readonly write: (path: string, body: ReadableStream<Uint8Array>) => Promise<number>;
  readonly remove: (path: string) => Promise<void>;
};

/* Bounds of a secret file (secret-files AC-1.3–1.5). R2 multipart parts must
   be at least 5 MiB (except the last) and all the same size, and a Worker
   request body is capped at 100 MB, so the server fixes 8 MiB parts. */
export const FILE_MAX_BYTES = 100 * 1024 * 1024;
export const FILE_PART_BYTES = 8 * 1024 * 1024;
export const FILE_NAME_MAX_BYTES = 255;
export const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

const CONTENT_TYPE_MAX_LENGTH = 127;
const CONTENT_TYPE = /^[\w.+-]+\/[\w.+-]+(\s*;\s*[\w.+-]+=[\w.+"-]+)*$/;
/* Path separators and C0/C1 control characters never belong in a name. */
const FORBIDDEN_IN_NAME = /[/\\\u0000-\u001f\u007f-\u009f]/;
const DOT_NAMES = new Set(['.', '..']);

const encoder = new TextEncoder();

export const isValidFileSize = (size: number): boolean => Number.isInteger(size) && size >= 1 && size <= FILE_MAX_BYTES;

export const isValidFileName = (name: string): boolean =>
  name !== '' &&
  !DOT_NAMES.has(name) &&
  !FORBIDDEN_IN_NAME.test(name) &&
  encoder.encode(name).byteLength <= FILE_NAME_MAX_BYTES;

export const normalizeContentType = (type: string | undefined): string =>
  type !== undefined && type.length <= CONTENT_TYPE_MAX_LENGTH && CONTENT_TYPE.test(type) ? type : DEFAULT_CONTENT_TYPE;

export const partCountOf = (size: number): number => Math.ceil(size / FILE_PART_BYTES);

/* Exact length part `partNumber` (1-based) of a `size`-byte file must have;
   undefined for a part number the file does not have. */
export const expectedPartSize = (size: number, partNumber: number): number | undefined => {
  const count = partCountOf(size);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > count) {
    return undefined;
  }
  return partNumber < count ? FILE_PART_BYTES : size - (count - 1) * FILE_PART_BYTES;
};

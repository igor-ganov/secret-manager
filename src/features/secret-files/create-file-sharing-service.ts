import type { IssuedLink } from '../sharing/sharing-service.ts';
import {
  expectedPartSize,
  FILE_MAX_BYTES,
  FILE_NAME_MAX_BYTES,
  FILE_PART_BYTES,
  isValidFileName,
  isValidFileSize,
  normalizeContentType,
  partCountOf,
} from './file-limits.ts';
import type { FileLinkStore, StoredFile, UploadSession } from './file-link-store.ts';
import type { FileObjectStore } from './file-object-store.ts';
import type { FileFailure, FileOwner, FileResult, FileSharingService, FileUploadRequest } from './file-sharing-service.ts';

export type FileSharingDependencies = {
  readonly objects: FileObjectStore;
  readonly links: FileLinkStore;
  /* The account's link lifetime (sharing.getTtlMinutes). */
  readonly ttlMinutesFor: (userId: number) => Promise<number>;
  readonly buildLinkUrl: (token: string) => string;
  readonly createToken: () => string;
  readonly now: () => number;
};

const MS_PER_MINUTE = 60 * 1000;
/* An upload session lives one hour (AC-1.8): enough for 100 MiB on a slow line. */
const UPLOAD_WINDOW_MS = 60 * MS_PER_MINUTE;

export const FILE_SIZE_ERROR = `A file must be 1 byte to 100 MiB (${String(FILE_MAX_BYTES)} bytes).`;
export const FILE_NAME_ERROR = `A file name must be 1–${String(FILE_NAME_MAX_BYTES)} bytes without path separators or control characters.`;

const invalid = (message: string): FileResult<never> => ({ ok: false, error: { kind: 'invalid', message } });
const MISSING: FileResult<never> = { ok: false, error: { kind: 'missing' } };
const ok = <T>(value: T): FileResult<T> => ({ ok: true, value });

const validate = ({ name, size }: Pick<FileUploadRequest, 'name' | 'size'>): FileFailure | undefined => {
  if (!isValidFileSize(size)) {
    return { kind: 'invalid', message: FILE_SIZE_ERROR };
  }
  return isValidFileName(name) ? undefined : { kind: 'invalid', message: FILE_NAME_ERROR };
};

const missingParts = (session: UploadSession, recorded: readonly number[]): readonly number[] =>
  Array.from({ length: partCountOf(session.size) }, (_, index) => index + 1).filter((part) => !recorded.includes(part));

const toStored = ({ objectKey, name, size, contentType }: StoredFile): StoredFile => ({ objectKey, name, size, contentType });

export const createFileSharingService = ({
  objects,
  links,
  ttlMinutesFor,
  buildLinkUrl,
  createToken,
  now,
}: FileSharingDependencies): FileSharingService => {
  const ttlOf = async (owner: FileOwner): Promise<number> => (owner.kind === 'drop' ? owner.ttlMinutes : ttlMinutesFor(owner.userId));

  const issueLink = async (file: StoredFile, ttlMinutes: number): Promise<IssuedLink> => {
    const token = await links.issue(file, ttlMinutes * MS_PER_MINUTE);
    return { url: buildLinkUrl(token), ttlMinutes };
  };

  const begin: FileSharingService['begin'] = async (owner, request) => {
    const failure = validate(request);
    if (failure !== undefined) {
      return { ok: false, error: failure };
    }
    const contentType = normalizeContentType(request.contentType);
    const objectKey = createToken();
    const multipartId = await objects.createMultipart(objectKey, contentType);
    const uploadId = createToken();
    const expiresAt = now() + UPLOAD_WINDOW_MS;
    await links.beginUpload({
      uploadId,
      objectKey,
      multipartId,
      name: request.name,
      size: request.size,
      contentType,
      ttlMinutes: await ttlOf(owner),
      expiresAt,
    });
    return ok({ uploadId, partSize: FILE_PART_BYTES, partCount: partCountOf(request.size), expiresAt });
  };

  const putPart: FileSharingService['putPart'] = async (uploadId, partNumber, bytes) => {
    const session = await links.findUpload(uploadId);
    if (session === undefined) {
      return MISSING;
    }
    const expected = expectedPartSize(session.size, partNumber);
    if (expected === undefined) {
      return invalid(`This file has parts 1–${String(partCountOf(session.size))}.`);
    }
    if (bytes.byteLength !== expected) {
      return invalid(`Part ${String(partNumber)} must be exactly ${String(expected)} bytes.`);
    }
    await links.recordPart(uploadId, await objects.putPart(session.objectKey, session.multipartId, partNumber, bytes));
    return ok(true);
  };

  /* Assembles the parts; storage failures abort the upload so nothing is
     left half-written. */
  const assemble = async (session: UploadSession, parts: Awaited<ReturnType<FileLinkStore['listParts']>>): Promise<FileResult<IssuedLink>> => {
    try {
      await objects.completeMultipart(session.objectKey, session.multipartId, parts);
    } catch {
      await objects.abortMultipart(session.objectKey, session.multipartId);
      return invalid('The file could not be assembled; upload it again.');
    }
    return ok(await issueLink(toStored(session), session.ttlMinutes));
  };

  const complete: FileSharingService['complete'] = async (uploadId) => {
    const session = await links.findUpload(uploadId);
    if (session === undefined) {
      return MISSING;
    }
    const parts = await links.listParts(uploadId);
    const missing = missingParts(session, parts.map((part) => part.partNumber));
    if (missing.length > 0) {
      return invalid(`Upload parts ${missing.join(', ')} first.`);
    }
    /* endUpload is the atomic step: of two racing completions one gets nothing. */
    const ended = await links.endUpload(uploadId);
    return ended === undefined ? MISSING : assemble(ended, parts);
  };

  const abort: FileSharingService['abort'] = async (uploadId) => {
    const ended = await links.endUpload(uploadId);
    if (ended === undefined) {
      return false;
    }
    await objects.abortMultipart(ended.objectKey, ended.multipartId);
    return true;
  };

  const open: FileSharingService['open'] = async (token) => {
    const file = await links.claim(token);
    if (file === undefined) {
      return undefined;
    }
    const body = await objects.open(file.objectKey);
    if (body === undefined) {
      return undefined;
    }
    return { name: file.name, size: file.size, contentType: file.contentType, body, dispose: () => objects.remove(file.objectKey) };
  };

  const shareBytes: FileSharingService['shareBytes'] = async (userId, { name, contentType }, bytes) => {
    const failure = validate({ name, size: bytes.byteLength });
    if (failure !== undefined) {
      return { ok: false, error: failure };
    }
    const objectKey = createToken();
    const type = normalizeContentType(contentType);
    await objects.put(objectKey, bytes, type);
    return ok(await issueLink({ objectKey, name, size: bytes.byteLength, contentType: type }, await ttlMinutesFor(userId)));
  };

  const sweep: FileSharingService['sweep'] = async () => {
    const expired = await links.sweep();
    await Promise.all([
      ...expired.objectKeys.map((key) => objects.remove(key)),
      ...expired.uploads.map(({ objectKey, multipartId }) => objects.abortMultipart(objectKey, multipartId)),
    ]);
  };

  return {
    begin,
    putPart,
    complete,
    abort,
    peek: async (token) => {
      const file = await links.peek(token);
      return file === undefined ? undefined : { name: file.name, size: file.size, contentType: file.contentType };
    },
    open,
    shareBytes,
    sweep,
  };
};

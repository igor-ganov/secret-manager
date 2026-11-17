import type { UploadedPart } from './file-object-store.ts';
import type { ExpiredFiles, FileLinkStore, StoredFile, UploadSession } from './file-link-store.ts';

export type FileLinkStoreOptions = {
  readonly now: () => number;
  readonly createToken: () => string;
};

type LiveFile = StoredFile & { readonly expiresAt: number };

const byPartNumber = (left: UploadedPart, right: UploadedPart): number => left.partNumber - right.partNumber;

const toStored = ({ objectKey, name, size, contentType }: StoredFile): StoredFile => ({ objectKey, name, size, contentType });

/* In-memory adapter for the local server and tests: like local text links, a
   restart forgets every file link, which is the safe failure mode. */
export const createFileLinkStore = ({ now, createToken }: FileLinkStoreOptions): FileLinkStore => {
  const sessions = new Map<string, UploadSession>();
  const parts = new Map<string, Map<number, UploadedPart>>();
  const files = new Map<string, LiveFile>();

  const live = <T extends { readonly expiresAt: number }>(entry: T | undefined): T | undefined =>
    entry !== undefined && entry.expiresAt > now() ? entry : undefined;

  const forget = (uploadId: string): void => {
    sessions.delete(uploadId);
    parts.delete(uploadId);
  };

  /* Expired entries stay where they are: only `sweep` removes them, because
     only sweep reports their objects for deletion. */
  const endUpload = async (uploadId: string): Promise<UploadSession | undefined> => {
    const session = live(sessions.get(uploadId));
    if (session !== undefined) {
      forget(uploadId);
    }
    return session;
  };

  const claim = async (token: string): Promise<StoredFile | undefined> => {
    const file = live(files.get(token));
    if (file === undefined) {
      return undefined;
    }
    files.delete(token);
    return toStored(file);
  };

  const sweep = async (): Promise<ExpiredFiles> => {
    const current = now();
    const expiredFiles = [...files].filter(([, file]) => file.expiresAt <= current);
    const expiredSessions = [...sessions.values()].filter((session) => session.expiresAt <= current);
    expiredFiles.forEach(([token]) => files.delete(token));
    expiredSessions.forEach((session) => forget(session.uploadId));
    return {
      objectKeys: expiredFiles.map(([, file]) => file.objectKey),
      uploads: expiredSessions.map(({ objectKey, multipartId }) => ({ objectKey, multipartId })),
    };
  };

  return {
    beginUpload: async (session) => {
      sessions.set(session.uploadId, session);
    },
    findUpload: async (uploadId) => live(sessions.get(uploadId)),
    recordPart: async (uploadId, part) => {
      parts.set(uploadId, (parts.get(uploadId) ?? new Map<number, UploadedPart>()).set(part.partNumber, part));
    },
    listParts: async (uploadId) => [...(parts.get(uploadId)?.values() ?? [])].sort(byPartNumber),
    endUpload,
    issue: async (file, ttlMs) => {
      const token = createToken();
      files.set(token, { ...toStored(file), expiresAt: now() + ttlMs });
      return token;
    },
    peek: async (token) => {
      const file = live(files.get(token));
      return file === undefined ? undefined : toStored(file);
    },
    claim,
    sweep,
  };
};

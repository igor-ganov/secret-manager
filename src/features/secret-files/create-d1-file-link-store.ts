import type { D1Database } from '../cloudflare/d1-types.ts';
import { firstRow } from '../cloudflare/first-row.ts';
import type { UploadedPart } from './file-object-store.ts';
import type { FileLinkStore, StoredFile, UploadSession } from './file-link-store.ts';

export type D1FileLinkStoreOptions = {
  readonly database: D1Database;
  readonly now: () => number;
  readonly createToken: () => string;
};

type FileRow = {
  readonly object_key: string;
  readonly file_name: string;
  readonly size_bytes: number;
  readonly content_type: string;
};

type SessionRow = FileRow & {
  readonly upload_id: string;
  readonly multipart_id: string;
  readonly ttl_minutes: number;
  readonly expires_at: number;
};

type PartRow = { readonly part_number: number; readonly etag: string };

const FILE_COLUMNS = 'object_key, file_name, size_bytes, content_type';
const SESSION_COLUMNS = `upload_id, multipart_id, ${FILE_COLUMNS}, ttl_minutes, expires_at`;

const toFile = (row: FileRow): StoredFile => ({
  objectKey: row.object_key,
  name: row.file_name,
  size: row.size_bytes,
  contentType: row.content_type,
});

const toSession = (row: SessionRow): UploadSession => ({
  uploadId: row.upload_id,
  ...toFile(row),
  multipartId: row.multipart_id,
  ttlMinutes: row.ttl_minutes,
  expiresAt: row.expires_at,
});

const toPart = (row: PartRow): UploadedPart => ({ partNumber: row.part_number, etag: row.etag });

/* D1 adapter (secret-files design §2). Reads ignore expired rows; the
   destructive reads use DELETE … RETURNING so they are atomic. */
export const createD1FileLinkStore = ({ database, now, createToken }: D1FileLinkStoreOptions): FileLinkStore => {
  const dropParts = (uploadId: string) => database.prepare('DELETE FROM file_upload_parts WHERE upload_id = ?1').bind(uploadId).run();

  const beginUpload: FileLinkStore['beginUpload'] = async (session) => {
    await database
      .prepare(`INSERT INTO file_uploads (${SESSION_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`)
      .bind(session.uploadId, session.multipartId, session.objectKey, session.name, session.size, session.contentType, session.ttlMinutes, session.expiresAt)
      .run();
  };

  const findUpload: FileLinkStore['findUpload'] = async (uploadId) => {
    const row = await firstRow<SessionRow>(database.prepare(`SELECT ${SESSION_COLUMNS} FROM file_uploads WHERE upload_id = ?1 AND expires_at > ?2`).bind(uploadId, now()));
    return row === undefined ? undefined : toSession(row);
  };

  const recordPart: FileLinkStore['recordPart'] = async (uploadId, part) => {
    await database
      .prepare('INSERT OR REPLACE INTO file_upload_parts (upload_id, part_number, etag) VALUES (?1, ?2, ?3)')
      .bind(uploadId, part.partNumber, part.etag)
      .run();
  };

  const listParts: FileLinkStore['listParts'] = async (uploadId) =>
    (
      await database
        .prepare('SELECT part_number, etag FROM file_upload_parts WHERE upload_id = ?1 ORDER BY part_number')
        .bind(uploadId)
        .all<PartRow>()
    ).results.map(toPart);

  /* Only a live session ends here; an expired one stays for the sweep, which
     reports it so its multipart upload gets aborted. */
  const endUpload: FileLinkStore['endUpload'] = async (uploadId) => {
    const row = await firstRow<SessionRow>(
      database.prepare(`DELETE FROM file_uploads WHERE upload_id = ?1 AND expires_at > ?2 RETURNING ${SESSION_COLUMNS}`).bind(uploadId, now()),
    );
    if (row === undefined) {
      return undefined;
    }
    await dropParts(uploadId);
    return toSession(row);
  };

  const issue: FileLinkStore['issue'] = async (file, ttlMs) => {
    const token = createToken();
    await database
      .prepare(`INSERT INTO one_time_files (token, ${FILE_COLUMNS}, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(token, file.objectKey, file.name, file.size, file.contentType, now() + ttlMs)
      .run();
    return token;
  };

  const peek: FileLinkStore['peek'] = async (token) => {
    const row = await firstRow<FileRow>(database.prepare(`SELECT ${FILE_COLUMNS} FROM one_time_files WHERE token = ?1 AND expires_at > ?2`).bind(token, now()));
    return row === undefined ? undefined : toFile(row);
  };

  const claim: FileLinkStore['claim'] = async (token) => {
    const row = await firstRow<FileRow>(database.prepare(`DELETE FROM one_time_files WHERE token = ?1 AND expires_at > ?2 RETURNING ${FILE_COLUMNS}`).bind(token, now()));
    return row === undefined ? undefined : toFile(row);
  };

  const sweep: FileLinkStore['sweep'] = async () => {
    const current = now();
    const files = await database
      .prepare('DELETE FROM one_time_files WHERE expires_at <= ?1 RETURNING object_key')
      .bind(current)
      .all<Pick<FileRow, 'object_key'>>();
    const uploads = await database
      .prepare('DELETE FROM file_uploads WHERE expires_at <= ?1 RETURNING upload_id, object_key, multipart_id')
      .bind(current)
      .all<Pick<SessionRow, 'upload_id' | 'object_key' | 'multipart_id'>>();
    await Promise.all(uploads.results.map((row) => dropParts(row.upload_id)));
    return {
      objectKeys: files.results.map((row) => row.object_key),
      uploads: uploads.results.map((row) => ({ objectKey: row.object_key, multipartId: row.multipart_id })),
    };
  };

  return { beginUpload, findUpload, recordPart, listParts, endUpload, issue, peek, claim, sweep };
};

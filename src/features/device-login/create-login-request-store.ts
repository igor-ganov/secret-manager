import { Database } from 'bun:sqlite';
import { claimableToken, NO_ACCOUNT, NO_TOKEN, REQUEST_COLUMNS, rowToView, type LoginRequestRow } from './login-request-row.ts';
import type { LoginRequestStore } from './login-request-store.ts';

export type LoginRequestStoreOptions = {
  readonly databasePath: string;
  readonly now: () => number;
};

export const createLoginRequestStore = ({ databasePath, now }: LoginRequestStoreOptions): LoginRequestStore => {
  const database = new Database(databasePath, { create: true });
  database.run(
    `CREATE TABLE IF NOT EXISTS device_requests (
      code_hash TEXT PRIMARY KEY,
      poll_hash TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      subject TEXT NOT NULL,
      callback TEXT NOT NULL,
      status TEXT NOT NULL,
      account_id INTEGER NOT NULL,
      issued_token TEXT NOT NULL,
      grant_code TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`,
  );

  const insert = database.query<undefined, [string, string, string, string, string, string, number, string, number]>(
    `INSERT INTO device_requests (code_hash, poll_hash, kind, label, subject, callback, status, account_id, issued_token, grant_code, expires_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7, ?8, '', ?9)`,
  );
  const sweep = database.query<undefined, [number]>('DELETE FROM device_requests WHERE expires_at <= ?1');
  const selectByCode = database.query<LoginRequestRow, [string, number]>(
    `SELECT ${REQUEST_COLUMNS} FROM device_requests WHERE code_hash = ?1 AND expires_at > ?2`,
  );
  const selectByPoll = database.query<LoginRequestRow, [string, number]>(
    `SELECT ${REQUEST_COLUMNS} FROM device_requests WHERE poll_hash = ?1 AND expires_at > ?2`,
  );
  const approve = database.query<undefined, [number, string, string, string, number]>(
    `UPDATE device_requests SET status = 'approved', account_id = ?1, issued_token = ?2, grant_code = ?3
     WHERE code_hash = ?4 AND status = 'pending' AND expires_at > ?5`,
  );
  const deny = database.query<undefined, [string, number]>(
    `UPDATE device_requests SET status = 'denied' WHERE code_hash = ?1 AND status = 'pending' AND expires_at > ?2`,
  );
  const clearToken = database.query<undefined, [string]>(
    "UPDATE device_requests SET issued_token = '' WHERE poll_hash = ?1",
  );

  const changed = (): boolean => database.query<{ readonly n: number }, []>('SELECT changes() AS n').get()?.n === 1;

  return {
    create: async ({ codeHash, pollHash, kind, label, subject, callback, expiresAt }) => {
      sweep.run(now());
      insert.run(codeHash, pollHash, kind, label, subject, callback, NO_ACCOUNT, NO_TOKEN, expiresAt);
    },
    peek: async (codeHash) => {
      const row = selectByCode.get(codeHash, now());
      return row ? rowToView(row) : undefined;
    },
    approve: async (codeHash, accountId, issuedToken, grant) =>
      database.transaction(() => {
        approve.run(accountId, issuedToken, grant, codeHash, now());
        return changed();
      })(),
    deny: async (codeHash) =>
      database.transaction(() => {
        deny.run(codeHash, now());
        return changed();
      })(),
    claim: async (pollHash, grant) =>
      database.transaction(() => {
        const token = claimableToken(selectByPoll.get(pollHash, now()) ?? undefined, grant);
        clearToken.run(pollHash);
        return token;
      })(),
  };
};

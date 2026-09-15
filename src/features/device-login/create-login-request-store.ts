import { Database } from 'bun:sqlite';
import { NO_TOKEN, rowToPoll, rowToView, type LoginRequestRow } from './login-request-row.ts';
import type { LoginRequestStore } from './login-request-store.ts';

export type LoginRequestStoreOptions = {
  readonly databasePath: string;
  readonly now: () => number;
};

const COLUMNS = 'kind, label, subject, status, issued_token';

export const createLoginRequestStore = ({ databasePath, now }: LoginRequestStoreOptions): LoginRequestStore => {
  const database = new Database(databasePath, { create: true });
  database.run(
    `CREATE TABLE IF NOT EXISTS login_requests (
      code_hash TEXT PRIMARY KEY,
      poll_hash TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      account_id INTEGER,
      issued_token TEXT,
      expires_at INTEGER NOT NULL
    )`,
  );

  const insert = database.query<undefined, [string, string, string, string, string, number]>(
    `INSERT INTO login_requests (code_hash, poll_hash, kind, label, subject, status, issued_token, expires_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 'pending', '', ?6)`,
  );
  const sweep = database.query<undefined, [number]>('DELETE FROM login_requests WHERE expires_at <= ?1');
  const selectByCode = database.query<LoginRequestRow, [string, number]>(
    `SELECT ${COLUMNS} FROM login_requests WHERE code_hash = ?1 AND expires_at > ?2`,
  );
  const selectByPoll = database.query<LoginRequestRow, [string, number]>(
    `SELECT ${COLUMNS} FROM login_requests WHERE poll_hash = ?1 AND expires_at > ?2`,
  );
  const approve = database.query<undefined, [number, string, string, number]>(
    `UPDATE login_requests SET status = 'approved', account_id = ?1, issued_token = ?2
     WHERE code_hash = ?3 AND status = 'pending' AND expires_at > ?4`,
  );
  const deny = database.query<undefined, [string, number]>(
    `UPDATE login_requests SET status = 'denied' WHERE code_hash = ?1 AND status = 'pending' AND expires_at > ?2`,
  );
  const clearToken = database.query<undefined, [string]>(
    "UPDATE login_requests SET issued_token = '' WHERE poll_hash = ?1",
  );

  const changed = (): boolean => database.query<{ readonly n: number }, []>('SELECT changes() AS n').get()?.n === 1;

  return {
    create: async ({ codeHash, pollHash, kind, label, subject, expiresAt }) => {
      sweep.run(now());
      insert.run(codeHash, pollHash, kind, label, subject, expiresAt);
    },
    peek: async (codeHash) => {
      const row = selectByCode.get(codeHash, now());
      return row ? rowToView(row) : undefined;
    },
    approve: async (codeHash, accountId, issuedToken) =>
      database.transaction(() => {
        approve.run(accountId, issuedToken ?? NO_TOKEN, codeHash, now());
        return changed();
      })(),
    deny: async (codeHash) =>
      database.transaction(() => {
        deny.run(codeHash, now());
        return changed();
      })(),
    poll: async (pollHash) =>
      database.transaction(() => {
        const row = selectByPoll.get(pollHash, now());
        clearToken.run(pollHash);
        return row ? rowToPoll(row) : undefined;
      })(),
  };
};

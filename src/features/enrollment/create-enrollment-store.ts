import { Database } from 'bun:sqlite';
import type { EnrollmentStore } from './enrollment-store.ts';

export type EnrollmentStoreOptions = {
  readonly databasePath: string;
  readonly now: () => number;
};

type AccountRow = { readonly account_id: number };

export const createEnrollmentStore = ({ databasePath, now }: EnrollmentStoreOptions): EnrollmentStore => {
  const database = new Database(databasePath, { create: true });
  database.run(
    `CREATE TABLE IF NOT EXISTS enrollments (
      code_hash TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`,
  );

  const insert = database.query<undefined, [string, number, number]>(
    'INSERT INTO enrollments (code_hash, account_id, expires_at) VALUES (?1, ?2, ?3)',
  );
  const sweep = database.query<undefined, [number]>('DELETE FROM enrollments WHERE expires_at <= ?1');
  const select = database.query<AccountRow, [string, number]>(
    'SELECT account_id FROM enrollments WHERE code_hash = ?1 AND expires_at > ?2',
  );
  const remove = database.query<undefined, [string]>('DELETE FROM enrollments WHERE code_hash = ?1');

  return {
    create: async (codeHash, accountId, expiresAt) => {
      sweep.run(now());
      insert.run(codeHash, accountId, expiresAt);
    },
    peek: async (codeHash) => select.get(codeHash, now())?.account_id,
    consume: async (codeHash) =>
      database.transaction(() => {
        const accountId = select.get(codeHash, now())?.account_id;
        remove.run(codeHash);
        return accountId;
      })(),
  };
};

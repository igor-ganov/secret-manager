import { Database } from 'bun:sqlite';
import type { AccountRecord, AccountStore, NewAccount } from './account-store.ts';

type AccountRow = { readonly account_id: number; readonly name: string };
type HandleRow = { readonly user_handle: string };
type IdRow = { readonly account_id: number };

export const createAccountStore = (databasePath: string): AccountStore => {
  const database = new Database(databasePath, { create: true });
  database.run(
    `CREATE TABLE IF NOT EXISTS accounts (
      account_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      user_handle TEXT NOT NULL UNIQUE,
      recovery_hash TEXT,
      created_at INTEGER NOT NULL
    )`,
  );

  const insert = database.query<undefined, [number, string, string, string, number]>(
    'INSERT INTO accounts (account_id, name, user_handle, recovery_hash, created_at) VALUES (?1, ?2, ?3, ?4, ?5)',
  );
  const select = database.query<AccountRow, [number]>(
    'SELECT account_id, name FROM accounts WHERE account_id = ?1',
  );
  const selectHandle = database.query<HandleRow, [number]>(
    'SELECT user_handle FROM accounts WHERE account_id = ?1',
  );
  const selectByRecovery = database.query<IdRow, [string]>(
    'SELECT account_id FROM accounts WHERE recovery_hash = ?1',
  );
  const updateRecovery = database.query<undefined, [string, number]>(
    'UPDATE accounts SET recovery_hash = ?1 WHERE account_id = ?2',
  );

  const toRecord = (row: AccountRow): AccountRecord => ({ id: row.account_id, name: row.name });

  return {
    create: async ({ id, name, userHandle, recoveryHash, createdAt }: NewAccount) => {
      insert.run(id, name, userHandle, recoveryHash, createdAt);
    },
    get: async (id) => {
      const row = select.get(id);
      return row ? toRecord(row) : undefined;
    },
    userHandleOf: async (id) => selectHandle.get(id)?.user_handle,
    findByRecoveryHash: async (hash) => selectByRecovery.get(hash)?.account_id,
    setRecoveryHash: async (id, hash) => {
      updateRecovery.run(hash, id);
    },
  };
};

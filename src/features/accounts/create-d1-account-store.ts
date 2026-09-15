import type { D1Database } from '../cloudflare/d1-types.ts';
import type { AccountRecord, AccountStore, NewAccount } from './account-store.ts';

type AccountRow = { readonly account_id: number; readonly name: string };
type HandleRow = { readonly user_handle: string };
type IdRow = { readonly account_id: number };

export const createD1AccountStore = (database: D1Database): AccountStore => ({
  create: async ({ id, name, userHandle, recoveryHash, createdAt }: NewAccount) => {
    await database
      .prepare(
        'INSERT INTO accounts (account_id, name, user_handle, recovery_hash, created_at) VALUES (?1, ?2, ?3, ?4, ?5)',
      )
      .bind(id, name, userHandle, recoveryHash, createdAt)
      .run();
  },
  get: async (id): Promise<AccountRecord | undefined> => {
    const row = await database
      .prepare('SELECT account_id, name FROM accounts WHERE account_id = ?1')
      .bind(id)
      .first<AccountRow>();
    return row ? { id: row.account_id, name: row.name } : undefined;
  },
  userHandleOf: async (id) =>
    (
      await database
        .prepare('SELECT user_handle FROM accounts WHERE account_id = ?1')
        .bind(id)
        .first<HandleRow>()
    )?.user_handle,
  findByRecoveryHash: async (hash) =>
    (
      await database
        .prepare('SELECT account_id FROM accounts WHERE recovery_hash = ?1')
        .bind(hash)
        .first<IdRow>()
    )?.account_id,
  setRecoveryHash: async (id, hash) => {
    await database
      .prepare('UPDATE accounts SET recovery_hash = ?1 WHERE account_id = ?2')
      .bind(hash, id)
      .run();
  },
});

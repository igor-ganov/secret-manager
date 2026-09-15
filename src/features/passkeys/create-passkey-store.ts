import { Database } from 'bun:sqlite';
import { PASSKEY_COLUMNS, passkeyToValues, rowToPasskey, type PasskeyRow } from './passkey-row.ts';
import type { PasskeyStore } from './passkey-store.ts';

type OwnerRow = { readonly account_id: number };

export const createPasskeyStore = (databasePath: string): PasskeyStore => {
  const database = new Database(databasePath, { create: true });
  database.run(
    `CREATE TABLE IF NOT EXISTS passkeys (
      credential_id TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL,
      transports TEXT NOT NULL,
      backed_up INTEGER NOT NULL,
      label TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
  );
  database.run('CREATE INDEX IF NOT EXISTS passkeys_account ON passkeys (account_id)');

  const insert = database.query<undefined, [string, number, string, number, string, number, string, number]>(
    `INSERT INTO passkeys (${PASSKEY_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  );
  const select = database.query<PasskeyRow, [string]>(
    `SELECT ${PASSKEY_COLUMNS} FROM passkeys WHERE credential_id = ?1`,
  );
  const selectByAccount = database.query<PasskeyRow, [number]>(
    `SELECT ${PASSKEY_COLUMNS} FROM passkeys WHERE account_id = ?1 ORDER BY created_at`,
  );
  const selectOwner = database.query<OwnerRow, [string]>(
    'SELECT account_id FROM passkeys WHERE credential_id = ?1',
  );
  const update = database.query<undefined, [number, number, string]>(
    'UPDATE passkeys SET counter = ?1, backed_up = ?2 WHERE credential_id = ?3',
  );
  const remove = database.query<undefined, [number, string]>(
    'DELETE FROM passkeys WHERE account_id = ?1 AND credential_id = ?2',
  );

  return {
    add: async (passkey) => {
      insert.run(...passkeyToValues(passkey));
    },
    find: async (credentialId) => {
      const row = select.get(credentialId);
      return row ? rowToPasskey(row) : undefined;
    },
    listByAccount: async (accountId) => selectByAccount.all(accountId).map(rowToPasskey),
    updateCounter: async (credentialId, counter, backedUp) => {
      update.run(counter, backedUp ? 1 : 0, credentialId);
    },
    remove: async (accountId, credentialId) =>
      database.transaction(() => {
        const owned = selectOwner.get(credentialId)?.account_id === accountId;
        remove.run(accountId, credentialId);
        return owned;
      })(),
  };
};

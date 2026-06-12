import { Database } from 'bun:sqlite';
import type { SecretStore } from './secret-store.ts';

type ValueRow = { readonly value: string };
type KeyRow = { readonly key: string };

export const createSecretStore = (databasePath: string): SecretStore => {
  const database = new Database(databasePath, { create: true });
  database.run(
    `CREATE TABLE IF NOT EXISTS secrets (
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    )`,
  );

  const saveStatement = database.query<undefined, [number, string, string]>(
    `INSERT INTO secrets (user_id, key, value) VALUES (?1, ?2, ?3)
     ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value`,
  );
  const readStatement = database.query<ValueRow, [number, string]>(
    'SELECT value FROM secrets WHERE user_id = ?1 AND key = ?2',
  );
  const listStatement = database.query<KeyRow, [number]>(
    'SELECT key FROM secrets WHERE user_id = ?1 ORDER BY key',
  );
  const removeStatement = database.query<undefined, [number, string]>(
    'DELETE FROM secrets WHERE user_id = ?1 AND key = ?2',
  );

  const save = async (userId: number, key: string, value: string): Promise<void> => {
    saveStatement.run(userId, key, value);
  };

  const read = async (userId: number, key: string): Promise<string | undefined> =>
    readStatement.get(userId, key)?.value;

  const list = async (userId: number): Promise<readonly string[]> =>
    listStatement.all(userId).map((row) => row.key);

  const remove = async (userId: number, key: string): Promise<void> => {
    removeStatement.run(userId, key);
  };

  return { save, read, list, remove };
};

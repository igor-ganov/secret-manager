import type { D1Database } from '../cloudflare/d1-types.ts';
import type { SecretStore } from './secret-store.ts';

type ValueRow = { readonly value: string };
type KeyRow = { readonly key: string };

export const createD1SecretStore = (database: D1Database): SecretStore => {
  const save = async (userId: number, key: string, value: string): Promise<void> => {
    await database
      .prepare(
        `INSERT INTO secrets (user_id, key, value) VALUES (?1, ?2, ?3)
         ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value`,
      )
      .bind(userId, key, value)
      .run();
  };

  const read = async (userId: number, key: string): Promise<string | undefined> =>
    (
      await database
        .prepare('SELECT value FROM secrets WHERE user_id = ?1 AND key = ?2')
        .bind(userId, key)
        .first<ValueRow>()
    )?.value;

  const list = async (userId: number): Promise<readonly string[]> =>
    (
      await database
        .prepare('SELECT key FROM secrets WHERE user_id = ?1 ORDER BY key')
        .bind(userId)
        .all<KeyRow>()
    ).results.map((row) => row.key);

  const remove = async (userId: number, key: string): Promise<void> => {
    await database
      .prepare('DELETE FROM secrets WHERE user_id = ?1 AND key = ?2')
      .bind(userId, key)
      .run();
  };

  return { save, read, list, remove };
};

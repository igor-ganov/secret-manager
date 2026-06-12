import type { D1Database } from '../cloudflare/d1-types.ts';
import type { PendingSetStore } from './pending-set-store.ts';

type KeyRow = { readonly key: string };

export const createD1PendingSetStore = (database: D1Database): PendingSetStore => {
  const begin = async (userId: number, key: string): Promise<void> => {
    await database
      .prepare(
        `INSERT INTO pending_sets (user_id, key) VALUES (?1, ?2)
         ON CONFLICT (user_id) DO UPDATE SET key = excluded.key`,
      )
      .bind(userId, key)
      .run();
  };

  const take = async (userId: number): Promise<string | undefined> =>
    (
      await database
        .prepare('DELETE FROM pending_sets WHERE user_id = ?1 RETURNING key')
        .bind(userId)
        .first<KeyRow>()
    )?.key;

  const cancel = async (userId: number): Promise<void> => {
    await database.prepare('DELETE FROM pending_sets WHERE user_id = ?1').bind(userId).run();
  };

  return { begin, take, cancel };
};

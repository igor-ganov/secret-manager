import type { D1Database } from '../cloudflare/d1-types.ts';
import type { UserStore } from './user-store.ts';

type NameRow = { readonly name: string };

export const createD1UserStore = (database: D1Database): UserStore => {
  const saveName = async (userId: number, name: string): Promise<void> => {
    await database
      .prepare(
        `INSERT INTO users (user_id, name) VALUES (?1, ?2)
         ON CONFLICT (user_id) DO UPDATE SET name = excluded.name`,
      )
      .bind(userId, name)
      .run();
  };

  const getName = async (userId: number): Promise<string | undefined> =>
    (
      await database
        .prepare('SELECT name FROM users WHERE user_id = ?1')
        .bind(userId)
        .first<NameRow>()
    )?.name;

  return { saveName, getName };
};

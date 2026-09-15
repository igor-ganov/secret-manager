import { Database } from 'bun:sqlite';
import type { UserStore } from './user-store.ts';

type NameRow = { readonly name: string };

export const createUserStore = (databasePath: string): UserStore => {
  const database = new Database(databasePath, { create: true });
  database.run(
    `CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    )`,
  );

  const upsert = database.query<undefined, [number, string]>(
    `INSERT INTO users (user_id, name) VALUES (?1, ?2)
     ON CONFLICT (user_id) DO UPDATE SET name = excluded.name`,
  );
  const select = database.query<NameRow, [number]>('SELECT name FROM users WHERE user_id = ?1');

  const saveName = async (userId: number, name: string): Promise<void> => {
    upsert.run(userId, name);
  };

  const getName = async (userId: number): Promise<string | undefined> => select.get(userId)?.name;

  return { saveName, getName };
};

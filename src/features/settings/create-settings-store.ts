import { Database } from 'bun:sqlite';
import type { SettingsStore } from './settings-store.ts';

type MinutesRow = { readonly link_ttl_minutes: number };

export const createSettingsStore = (databasePath: string): SettingsStore => {
  const database = new Database(databasePath, { create: true });
  database.run(
    `CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY,
      link_ttl_minutes INTEGER NOT NULL
    )`,
  );

  const readStatement = database.query<MinutesRow, [number]>(
    'SELECT link_ttl_minutes FROM user_settings WHERE user_id = ?1',
  );
  const saveStatement = database.query<undefined, [number, number]>(
    `INSERT INTO user_settings (user_id, link_ttl_minutes) VALUES (?1, ?2)
     ON CONFLICT (user_id) DO UPDATE SET link_ttl_minutes = excluded.link_ttl_minutes`,
  );

  const getTtlMinutes = async (userId: number): Promise<number | undefined> =>
    readStatement.get(userId)?.link_ttl_minutes;

  const setTtlMinutes = async (userId: number, minutes: number): Promise<void> => {
    saveStatement.run(userId, minutes);
  };

  return { getTtlMinutes, setTtlMinutes };
};

import type { D1Database } from '../cloudflare/d1-types.ts';
import type { SettingsStore } from './settings-store.ts';

type MinutesRow = { readonly link_ttl_minutes: number };

export const createD1SettingsStore = (database: D1Database): SettingsStore => {
  const getTtlMinutes = async (userId: number): Promise<number | undefined> =>
    (
      await database
        .prepare('SELECT link_ttl_minutes FROM user_settings WHERE user_id = ?1')
        .bind(userId)
        .first<MinutesRow>()
    )?.link_ttl_minutes;

  const setTtlMinutes = async (userId: number, minutes: number): Promise<void> => {
    await database
      .prepare(
        `INSERT INTO user_settings (user_id, link_ttl_minutes) VALUES (?1, ?2)
         ON CONFLICT (user_id) DO UPDATE SET link_ttl_minutes = excluded.link_ttl_minutes`,
      )
      .bind(userId, minutes)
      .run();
  };

  return { getTtlMinutes, setTtlMinutes };
};

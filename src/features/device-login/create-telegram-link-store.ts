import { Database } from 'bun:sqlite';
import type { TelegramLinkStore } from './telegram-link-store.ts';

type AccountRow = { readonly account_id: number };
type UserRow = { readonly telegram_user_id: number };

export const createTelegramLinkStore = (databasePath: string): TelegramLinkStore => {
  const database = new Database(databasePath, { create: true });
  database.run(
    `CREATE TABLE IF NOT EXISTS telegram_links (
      telegram_user_id INTEGER PRIMARY KEY,
      account_id INTEGER NOT NULL,
      linked_at INTEGER NOT NULL
    )`,
  );

  const selectAccount = database.query<AccountRow, [number]>(
    'SELECT account_id FROM telegram_links WHERE telegram_user_id = ?1',
  );
  const selectUser = database.query<UserRow, [number]>(
    'SELECT telegram_user_id FROM telegram_links WHERE account_id = ?1 ORDER BY linked_at DESC',
  );
  const upsert = database.query<undefined, [number, number, number]>(
    `INSERT INTO telegram_links (telegram_user_id, account_id, linked_at) VALUES (?1, ?2, ?3)
     ON CONFLICT (telegram_user_id) DO UPDATE SET account_id = excluded.account_id, linked_at = excluded.linked_at`,
  );
  const remove = database.query<undefined, [number]>('DELETE FROM telegram_links WHERE telegram_user_id = ?1');

  return {
    accountFor: async (telegramUserId) => selectAccount.get(telegramUserId)?.account_id,
    telegramUserFor: async (accountId) => selectUser.get(accountId)?.telegram_user_id,
    link: async (telegramUserId, accountId, linkedAt) => {
      upsert.run(telegramUserId, accountId, linkedAt);
    },
    unlink: async (telegramUserId) => {
      remove.run(telegramUserId);
    },
  };
};

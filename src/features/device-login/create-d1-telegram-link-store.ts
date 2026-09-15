import type { D1Database } from '../cloudflare/d1-types.ts';
import type { TelegramLinkStore } from './telegram-link-store.ts';

type AccountRow = { readonly account_id: number };
type UserRow = { readonly telegram_user_id: number };

export const createD1TelegramLinkStore = (database: D1Database): TelegramLinkStore => ({
  accountFor: async (telegramUserId) =>
    (
      await database
        .prepare('SELECT account_id FROM telegram_links WHERE telegram_user_id = ?1')
        .bind(telegramUserId)
        .first<AccountRow>()
    )?.account_id,
  telegramUserFor: async (accountId) =>
    (
      await database
        .prepare('SELECT telegram_user_id FROM telegram_links WHERE account_id = ?1 ORDER BY linked_at DESC')
        .bind(accountId)
        .first<UserRow>()
    )?.telegram_user_id,
  link: async (telegramUserId, accountId, linkedAt) => {
    await database
      .prepare(
        `INSERT INTO telegram_links (telegram_user_id, account_id, linked_at) VALUES (?1, ?2, ?3)
         ON CONFLICT (telegram_user_id) DO UPDATE SET account_id = excluded.account_id, linked_at = excluded.linked_at`,
      )
      .bind(telegramUserId, accountId, linkedAt)
      .run();
  },
  unlink: async (telegramUserId) => {
    await database.prepare('DELETE FROM telegram_links WHERE telegram_user_id = ?1').bind(telegramUserId).run();
  },
});

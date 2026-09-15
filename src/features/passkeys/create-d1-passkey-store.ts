import type { D1Database } from '../cloudflare/d1-types.ts';
import { PASSKEY_COLUMNS, passkeyToValues, rowToPasskey, type PasskeyRow } from './passkey-row.ts';
import type { PasskeyStore } from './passkey-store.ts';

type IdRow = { readonly credential_id: string };

export const createD1PasskeyStore = (database: D1Database): PasskeyStore => ({
  add: async (passkey) => {
    await database
      .prepare(`INSERT INTO passkeys (${PASSKEY_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`)
      .bind(...passkeyToValues(passkey))
      .run();
  },
  find: async (credentialId) => {
    const row = await database
      .prepare(`SELECT ${PASSKEY_COLUMNS} FROM passkeys WHERE credential_id = ?1`)
      .bind(credentialId)
      .first<PasskeyRow>();
    return row ? rowToPasskey(row) : undefined;
  },
  listByAccount: async (accountId) =>
    (
      await database
        .prepare(`SELECT ${PASSKEY_COLUMNS} FROM passkeys WHERE account_id = ?1 ORDER BY created_at`)
        .bind(accountId)
        .all<PasskeyRow>()
    ).results.map(rowToPasskey),
  updateCounter: async (credentialId, counter, backedUp) => {
    await database
      .prepare('UPDATE passkeys SET counter = ?1, backed_up = ?2 WHERE credential_id = ?3')
      .bind(counter, backedUp ? 1 : 0, credentialId)
      .run();
  },
  remove: async (accountId, credentialId) =>
    (
      await database
        .prepare('DELETE FROM passkeys WHERE account_id = ?1 AND credential_id = ?2 RETURNING credential_id')
        .bind(accountId, credentialId)
        .first<IdRow>()
    )?.credential_id !== undefined,
});

import type { D1Database } from '../cloudflare/d1-types.ts';
import { claimableToken, NO_ACCOUNT, NO_TOKEN, REQUEST_COLUMNS, rowToView, type LoginRequestRow } from './login-request-row.ts';
import type { LoginRequestStore } from './login-request-store.ts';

export type D1LoginRequestStoreOptions = {
  readonly database: D1Database;
  readonly now: () => number;
};

type MarkerRow = { readonly code_hash: string };

export const createD1LoginRequestStore = ({ database, now }: D1LoginRequestStoreOptions): LoginRequestStore => ({
  create: async ({ codeHash, pollHash, kind, label, subject, callback, expiresAt }) => {
    await database.prepare('DELETE FROM device_requests WHERE expires_at <= ?1').bind(now()).run();
    await database
      .prepare(
        `INSERT INTO device_requests (code_hash, poll_hash, kind, label, subject, callback, status, account_id, issued_token, grant_code, expires_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7, ?8, '', ?9)`,
      )
      .bind(codeHash, pollHash, kind, label, subject, callback, NO_ACCOUNT, NO_TOKEN, expiresAt)
      .run();
  },
  peek: async (codeHash) => {
    const row = await database
      .prepare(`SELECT ${REQUEST_COLUMNS} FROM device_requests WHERE code_hash = ?1 AND expires_at > ?2`)
      .bind(codeHash, now())
      .first<LoginRequestRow>();
    return row ? rowToView(row) : undefined;
  },
  approve: async (codeHash, accountId, issuedToken, grant) =>
    (
      await database
        .prepare(
          `UPDATE device_requests SET status = 'approved', account_id = ?1, issued_token = ?2, grant_code = ?3
           WHERE code_hash = ?4 AND status = 'pending' AND expires_at > ?5 RETURNING code_hash`,
        )
        .bind(accountId, issuedToken, grant, codeHash, now())
        .first<MarkerRow>()
    )?.code_hash !== undefined,
  deny: async (codeHash) =>
    (
      await database
        .prepare(
          `UPDATE device_requests SET status = 'denied'
           WHERE code_hash = ?1 AND status = 'pending' AND expires_at > ?2 RETURNING code_hash`,
        )
        .bind(codeHash, now())
        .first<MarkerRow>()
    )?.code_hash !== undefined,
  /* Read, then clear: the token leaves the row on the first claim attempt
     for that device secret, so a second claim gets nothing. */
  claim: async (pollHash, grant) => {
    const row = await database
      .prepare(`SELECT ${REQUEST_COLUMNS} FROM device_requests WHERE poll_hash = ?1 AND expires_at > ?2`)
      .bind(pollHash, now())
      .first<LoginRequestRow>();
    await database.prepare("UPDATE device_requests SET issued_token = '' WHERE poll_hash = ?1").bind(pollHash).run();
    return claimableToken(row ?? undefined, grant);
  },
});

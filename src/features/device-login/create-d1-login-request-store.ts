import type { D1Database } from '../cloudflare/d1-types.ts';
import { NO_TOKEN, rowToPoll, rowToView, type LoginRequestRow } from './login-request-row.ts';
import type { LoginRequestStore } from './login-request-store.ts';

export type D1LoginRequestStoreOptions = {
  readonly database: D1Database;
  readonly now: () => number;
};

const COLUMNS = 'kind, label, subject, status, issued_token';
type MarkerRow = { readonly code_hash: string };

export const createD1LoginRequestStore = ({ database, now }: D1LoginRequestStoreOptions): LoginRequestStore => ({
  create: async ({ codeHash, pollHash, kind, label, subject, expiresAt }) => {
    await database.prepare('DELETE FROM login_requests WHERE expires_at <= ?1').bind(now()).run();
    await database
      .prepare(
        `INSERT INTO login_requests (code_hash, poll_hash, kind, label, subject, status, issued_token, expires_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'pending', '', ?6)`,
      )
      .bind(codeHash, pollHash, kind, label, subject, expiresAt)
      .run();
  },
  peek: async (codeHash) => {
    const row = await database
      .prepare(`SELECT ${COLUMNS} FROM login_requests WHERE code_hash = ?1 AND expires_at > ?2`)
      .bind(codeHash, now())
      .first<LoginRequestRow>();
    return row ? rowToView(row) : undefined;
  },
  approve: async (codeHash, accountId, issuedToken) =>
    (
      await database
        .prepare(
          `UPDATE login_requests SET status = 'approved', account_id = ?1, issued_token = ?2
           WHERE code_hash = ?3 AND status = 'pending' AND expires_at > ?4 RETURNING code_hash`,
        )
        .bind(accountId, issuedToken ?? NO_TOKEN, codeHash, now())
        .first<MarkerRow>()
    )?.code_hash !== undefined,
  deny: async (codeHash) =>
    (
      await database
        .prepare(
          `UPDATE login_requests SET status = 'denied'
           WHERE code_hash = ?1 AND status = 'pending' AND expires_at > ?2 RETURNING code_hash`,
        )
        .bind(codeHash, now())
        .first<MarkerRow>()
    )?.code_hash !== undefined,
  /* UPDATE … RETURNING reads and clears the token in one statement, so two
     concurrent polls cannot both receive it; the pre-update value is what
     the device gets, hence the two-step read. */
  poll: async (pollHash) => {
    const row = await database
      .prepare(`SELECT ${COLUMNS} FROM login_requests WHERE poll_hash = ?1 AND expires_at > ?2`)
      .bind(pollHash, now())
      .first<LoginRequestRow>();
    await database
      .prepare("UPDATE login_requests SET issued_token = '' WHERE poll_hash = ?1")
      .bind(pollHash)
      .run();
    return row ? rowToPoll(row) : undefined;
  },
});

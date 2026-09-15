import type { D1Database } from '../cloudflare/d1-types.ts';
import type { EnrollmentStore } from './enrollment-store.ts';

export type D1EnrollmentStoreOptions = {
  readonly database: D1Database;
  readonly now: () => number;
};

type Row = { readonly account_id: number; readonly expires_at: number };

export const createD1EnrollmentStore = ({ database, now }: D1EnrollmentStoreOptions): EnrollmentStore => ({
  create: async (codeHash, accountId, expiresAt) => {
    await database.prepare('DELETE FROM enrollments WHERE expires_at <= ?1').bind(now()).run();
    await database
      .prepare('INSERT INTO enrollments (code_hash, account_id, expires_at) VALUES (?1, ?2, ?3)')
      .bind(codeHash, accountId, expiresAt)
      .run();
  },
  peek: async (codeHash) =>
    (
      await database
        .prepare('SELECT account_id, expires_at FROM enrollments WHERE code_hash = ?1 AND expires_at > ?2')
        .bind(codeHash, now())
        .first<Row>()
    )?.account_id,
  consume: async (codeHash) => {
    const row = await database
      .prepare('DELETE FROM enrollments WHERE code_hash = ?1 RETURNING account_id, expires_at')
      .bind(codeHash)
      .first<Row>();
    return row && row.expires_at > now() ? row.account_id : undefined;
  },
});

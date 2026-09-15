import type { D1Database } from '../cloudflare/d1-types.ts';
import { sha256Hex } from '../crypto/sha256-hex.ts';
import { createToken } from '../one-time-links/create-token.ts';
import type { ApiTokenRecord, ApiTokenStore, ResolvedToken } from './api-token-store.ts';

export type D1ApiTokenStoreOptions = {
  readonly database: D1Database;
  readonly now: () => number;
};

type UserRow = { readonly user_id: number };
type RecordRow = { readonly token_hash: string; readonly label: string; readonly created_at: number };
type ChangesRow = { readonly token_hash: string };

const toRecord = (row: RecordRow): ApiTokenRecord => ({
  id: row.token_hash,
  label: row.label,
  createdAt: row.created_at,
});

export const createD1ApiTokenStore = ({ database, now }: D1ApiTokenStoreOptions): ApiTokenStore => {
  const create = async (userId: number, label: string) => {
    const token = createToken();
    const id = await sha256Hex(token);
    const createdAt = now();
    await database
      .prepare('INSERT INTO api_tokens (token_hash, user_id, label, created_at) VALUES (?1, ?2, ?3, ?4)')
      .bind(id, userId, label, createdAt)
      .run();
    return { token, record: { id, label, createdAt } };
  };

  const resolve = async (token: string): Promise<ResolvedToken | undefined> => {
    const id = await sha256Hex(token);
    const userId = (
      await database
        .prepare('SELECT user_id FROM api_tokens WHERE token_hash = ?1')
        .bind(id)
        .first<UserRow>()
    )?.user_id;
    return userId === undefined ? undefined : { userId, id };
  };

  const list = async (userId: number): Promise<readonly ApiTokenRecord[]> =>
    (
      await database
        .prepare(
          'SELECT token_hash, label, created_at FROM api_tokens WHERE user_id = ?1 ORDER BY created_at',
        )
        .bind(userId)
        .all<RecordRow>()
    ).results.map(toRecord);

  const revoke = async (userId: number, id: string): Promise<boolean> =>
    (
      await database
        .prepare('DELETE FROM api_tokens WHERE user_id = ?1 AND token_hash = ?2 RETURNING token_hash')
        .bind(userId, id)
        .first<ChangesRow>()
    )?.token_hash !== undefined;

  return { create, resolve, list, revoke };
};

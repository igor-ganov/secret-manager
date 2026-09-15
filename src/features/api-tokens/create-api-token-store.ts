import { Database } from 'bun:sqlite';
import { sha256Hex } from '../crypto/sha256-hex.ts';
import { createToken } from '../one-time-links/create-token.ts';
import type { ApiTokenRecord, ApiTokenStore, ResolvedToken } from './api-token-store.ts';

export type ApiTokenStoreOptions = {
  readonly databasePath: string;
  readonly now: () => number;
  readonly createToken?: () => string;
  readonly hashToken?: (token: string) => Promise<string>;
};

type UserRow = { readonly user_id: number };
type RecordRow = { readonly token_hash: string; readonly label: string; readonly created_at: number };

const toRecord = (row: RecordRow): ApiTokenRecord => ({
  id: row.token_hash,
  label: row.label,
  createdAt: row.created_at,
});

export const createApiTokenStore = ({
  databasePath,
  now,
  createToken: newToken = createToken,
  hashToken = sha256Hex,
}: ApiTokenStoreOptions): ApiTokenStore => {
  const database = new Database(databasePath, { create: true });
  database.run(
    `CREATE TABLE IF NOT EXISTS api_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
  );
  database.run('CREATE INDEX IF NOT EXISTS api_tokens_user ON api_tokens (user_id)');

  const insert = database.query<undefined, [string, number, string, number]>(
    'INSERT INTO api_tokens (token_hash, user_id, label, created_at) VALUES (?1, ?2, ?3, ?4)',
  );
  const select = database.query<UserRow, [string]>(
    'SELECT user_id FROM api_tokens WHERE token_hash = ?1',
  );
  const selectAll = database.query<RecordRow, [number]>(
    'SELECT token_hash, label, created_at FROM api_tokens WHERE user_id = ?1 ORDER BY created_at',
  );
  const remove = database.query<undefined, [number, string]>(
    'DELETE FROM api_tokens WHERE user_id = ?1 AND token_hash = ?2',
  );

  const create = async (userId: number, label: string) => {
    const token = newToken();
    const id = await hashToken(token);
    const createdAt = now();
    insert.run(id, userId, label, createdAt);
    return { token, record: { id, label, createdAt } };
  };

  const resolve = async (token: string): Promise<ResolvedToken | undefined> => {
    const id = await hashToken(token);
    const userId = select.get(id)?.user_id;
    return userId === undefined ? undefined : { userId, id };
  };

  const list = async (userId: number): Promise<readonly ApiTokenRecord[]> =>
    selectAll.all(userId).map(toRecord);

  const revoke = async (userId: number, id: string): Promise<boolean> =>
    database.transaction(() => {
      const existed = select.get(id)?.user_id === userId;
      remove.run(userId, id);
      return existed;
    })();

  return { create, resolve, list, revoke };
};

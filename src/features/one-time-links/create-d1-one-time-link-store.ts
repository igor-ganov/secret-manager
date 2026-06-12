import type { D1Database } from '../cloudflare/d1-types.ts';
import type { OneTimeLinkStore } from './one-time-link-store.ts';

type ValueRow = { readonly value: string };

export type D1OneTimeLinkStoreOptions = {
  readonly database: D1Database;
  readonly ttlMs: number;
  readonly now: () => number;
  readonly createToken: () => string;
};

export const createD1OneTimeLinkStore = ({
  database,
  ttlMs,
  now,
  createToken,
}: D1OneTimeLinkStoreOptions): OneTimeLinkStore => {
  const issue = async (value: string): Promise<string> => {
    const token = createToken();
    await database
      .prepare('DELETE FROM one_time_links WHERE expires_at <= ?1')
      .bind(now())
      .run();
    await database
      .prepare('INSERT INTO one_time_links (token, value, expires_at) VALUES (?1, ?2, ?3)')
      .bind(token, value, now() + ttlMs)
      .run();
    return token;
  };

  const peek = async (token: string): Promise<boolean> =>
    (await database
      .prepare('SELECT value FROM one_time_links WHERE token = ?1 AND expires_at > ?2')
      .bind(token, now())
      .first<ValueRow>()) !== null;

  /* DELETE … RETURNING makes the read-and-destroy atomic, so a link can never
     be served twice even under concurrent requests. */
  const consume = async (token: string): Promise<string | undefined> =>
    (
      await database
        .prepare('DELETE FROM one_time_links WHERE token = ?1 AND expires_at > ?2 RETURNING value')
        .bind(token, now())
        .first<ValueRow>()
    )?.value;

  return { issue, peek, consume };
};

import { Database } from 'bun:sqlite';
import { NO_ACCOUNT, rowToChallenge, type ChallengeRow } from './challenge-row.ts';
import type { ChallengeStore } from './challenge-store.ts';

export type ChallengeStoreOptions = {
  readonly databasePath: string;
  readonly now: () => number;
};

export const createChallengeStore = ({ databasePath, now }: ChallengeStoreOptions): ChallengeStore => {
  const database = new Database(databasePath, { create: true });
  database.run(
    `CREATE TABLE IF NOT EXISTS challenges (
      challenge TEXT PRIMARY KEY,
      flow TEXT NOT NULL,
      account_id INTEGER,
      payload TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`,
  );

  const insert = database.query<undefined, [string, string, number, string, number]>(
    'INSERT INTO challenges (challenge, flow, account_id, payload, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)',
  );
  const sweep = database.query<undefined, [number]>('DELETE FROM challenges WHERE expires_at <= ?1');
  const select = database.query<ChallengeRow, [string, number]>(
    'SELECT challenge, flow, account_id, payload, expires_at FROM challenges WHERE challenge = ?1 AND expires_at > ?2',
  );
  const remove = database.query<undefined, [string]>('DELETE FROM challenges WHERE challenge = ?1');

  return {
    put: async ({ challenge, flow, accountId, payload, expiresAt }) => {
      sweep.run(now());
      insert.run(challenge, flow, accountId ?? NO_ACCOUNT, payload, expiresAt);
    },
    take: async (challenge) =>
      database.transaction(() => {
        const row = select.get(challenge, now());
        remove.run(challenge);
        return row ? rowToChallenge(row) : undefined;
      })(),
  };
};

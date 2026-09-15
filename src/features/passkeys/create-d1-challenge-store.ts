import type { D1Database } from '../cloudflare/d1-types.ts';
import { NO_ACCOUNT, rowToChallenge, type ChallengeRow } from './challenge-row.ts';
import type { ChallengeStore } from './challenge-store.ts';

export type D1ChallengeStoreOptions = {
  readonly database: D1Database;
  readonly now: () => number;
};

export const createD1ChallengeStore = ({ database, now }: D1ChallengeStoreOptions): ChallengeStore => ({
  put: async ({ challenge, flow, accountId, payload, expiresAt }) => {
    await database.prepare('DELETE FROM challenges WHERE expires_at <= ?1').bind(now()).run();
    await database
      .prepare(
        'INSERT INTO challenges (challenge, flow, account_id, payload, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)',
      )
      .bind(challenge, flow, accountId ?? NO_ACCOUNT, payload, expiresAt)
      .run();
  },
  /* DELETE … RETURNING makes the single use atomic under concurrent verifies. */
  take: async (challenge) => {
    const row = await database
      .prepare(
        'DELETE FROM challenges WHERE challenge = ?1 RETURNING challenge, flow, account_id, payload, expires_at',
      )
      .bind(challenge)
      .first<ChallengeRow>();
    return row && row.expires_at > now() ? rowToChallenge(row) : undefined;
  },
});

import type { ChallengeFlow, ChallengeRecord } from './challenge-store.ts';

/* `account_id` 0 means "no account yet" (account ids start at 2^40), which
   keeps the row free of SQL NULL. */
export const NO_ACCOUNT = 0;

export type ChallengeRow = {
  readonly challenge: string;
  readonly flow: string;
  readonly account_id: number;
  readonly payload: string;
  readonly expires_at: number;
};

const FLOWS: readonly ChallengeFlow[] = ['register', 'login', 'add', 'enroll', 'recovery'];

const isFlow = (value: string): value is ChallengeFlow => FLOWS.some((flow) => flow === value);

/* A row with an unknown flow is treated as absent rather than trusted. */
export const rowToChallenge = (row: ChallengeRow): ChallengeRecord | undefined =>
  isFlow(row.flow)
    ? {
        challenge: row.challenge,
        flow: row.flow,
        accountId: row.account_id === NO_ACCOUNT ? undefined : row.account_id,
        payload: row.payload,
        expiresAt: row.expires_at,
      }
    : undefined;

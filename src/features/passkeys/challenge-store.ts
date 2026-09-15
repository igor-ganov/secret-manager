export type ChallengeFlow = 'register' | 'login' | 'add' | 'enroll' | 'recovery';

export type ChallengeRecord = {
  /* Base64url challenge, exactly as sent to the browser. */
  readonly challenge: string;
  readonly flow: ChallengeFlow;
  readonly accountId: number | undefined;
  /* Flow-specific state (pending account name, enrollment hash, …) in JSON form. */
  readonly payload: string;
  readonly expiresAt: number;
};

/* Challenges are single-use: `take` removes the row whether or not the
   ceremony that follows succeeds, and never returns an expired one. */
export type ChallengeStore = {
  readonly put: (record: ChallengeRecord) => Promise<void>;
  readonly take: (challenge: string) => Promise<ChallengeRecord | undefined>;
};

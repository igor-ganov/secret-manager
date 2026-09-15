import type { AccountStore } from '../accounts/account-store.ts';
import type { ChallengeFlow, ChallengeRecord, ChallengeStore } from './challenge-store.ts';
import type { PasskeyCeremonies } from './passkey-ceremonies.ts';
import type { PasskeyRecord, PasskeyStore } from './passkey-store.ts';

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type RegistrationFlowDeps = {
  readonly ceremonies: PasskeyCeremonies;
  readonly challenges: ChallengeStore;
  readonly passkeys: PasskeyStore;
  readonly accounts: AccountStore;
  readonly now: () => number;
};

export type StartRegistration = {
  readonly flow: ChallengeFlow;
  readonly accountId: number | undefined;
  readonly userHandle: string;
  readonly userName: string;
  readonly payload: string;
};

/* Mints creation options and parks the challenge with the flow's state. */
export const startRegistration = async (
  { ceremonies, challenges, passkeys, now }: RegistrationFlowDeps,
  { flow, accountId, userHandle, userName, payload }: StartRegistration,
): Promise<unknown> => {
  const existing = accountId === undefined ? [] : await passkeys.listByAccount(accountId);
  const { challenge, options } = await ceremonies.registrationOptions({ userHandle, userName, existing });
  await challenges.put({ challenge, flow, accountId, payload, expiresAt: now() + CHALLENGE_TTL_MS });
  return options;
};

export type FinishedRegistration = {
  readonly challenge: ChallengeRecord;
  readonly passkey: Omit<PasskeyRecord, 'accountId' | 'label' | 'createdAt'>;
};

/* Consumes the challenge (whatever happens next) and verifies the response.
   The caller decides which account the new passkey belongs to. */
export const finishRegistration = async (
  { ceremonies, challenges }: RegistrationFlowDeps,
  flow: ChallengeFlow,
  response: unknown,
): Promise<FinishedRegistration | undefined> => {
  const challengeValue = ceremonies.challengeOf(response);
  const challenge = challengeValue === undefined ? undefined : await challenges.take(challengeValue);
  if (challenge === undefined || challenge.flow !== flow) {
    return undefined;
  }
  const verified = await ceremonies.verifyRegistration(response, challenge.challenge);
  return verified === undefined ? undefined : { challenge, passkey: verified };
};

export const storePasskey = (
  { passkeys, now }: RegistrationFlowDeps,
  finished: FinishedRegistration,
  accountId: number,
  label: string,
): Promise<void> =>
  passkeys.add({ ...finished.passkey, accountId, label, createdAt: now() });

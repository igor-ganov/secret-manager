import type { PasskeyCeremonies } from './passkey-ceremonies.ts';

/* Test double for the WebAuthn layer: a "response" is a plain object with
   `challenge`, `id` and optionally `counter`/`fail`; verification succeeds
   when the challenge matches and `fail` is not set. Used by request-level
   tests; the real library is covered by the browser E2E suite. */
type FakeResponse = {
  readonly challenge?: string;
  readonly id?: string;
  readonly counter?: number;
  readonly fail?: boolean;
};

const asFake = (response: unknown): FakeResponse =>
  response instanceof Object && !Array.isArray(response) ? response : {};

export const createFakeCeremonies = (): PasskeyCeremonies => {
  let counter = 0;
  const nextChallenge = (): string => `challenge-${(counter += 1)}`;

  return {
    registrationOptions: async ({ userName, existing }) => {
      const challenge = nextChallenge();
      return { challenge, options: { challenge, userName, exclude: existing.map((passkey) => passkey.credentialId) } };
    },
    verifyRegistration: async (response, expectedChallenge) => {
      const fake = asFake(response);
      return fake.fail === true || fake.challenge !== expectedChallenge || fake.id === undefined
        ? undefined
        : { credentialId: fake.id, publicKey: `pk-${fake.id}`, counter: 0, transports: ['internal'], backedUp: false };
    },
    authenticationOptions: async () => {
      const challenge = nextChallenge();
      return { challenge, options: { challenge } };
    },
    verifyAuthentication: async (response, expectedChallenge, passkey) => {
      const fake = asFake(response);
      return fake.fail === true || fake.challenge !== expectedChallenge || fake.id !== passkey.credentialId
        ? undefined
        : { credentialId: passkey.credentialId, newCounter: fake.counter ?? passkey.counter + 1, backedUp: false };
    },
    credentialIdOf: (response) => asFake(response).id,
    challengeOf: (response) => asFake(response).challenge,
  };
};

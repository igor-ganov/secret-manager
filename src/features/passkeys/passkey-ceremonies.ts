import type { PasskeyRecord } from './passkey-store.ts';

export type RegistrationSubject = {
  readonly userHandle: string;
  readonly userName: string;
  readonly existing: readonly PasskeyRecord[];
};

/* Options JSON as handed to the browser; the challenge is the base64url
   string inside it. */
export type CeremonyOptions = {
  readonly challenge: string;
  readonly options: unknown;
};

export type VerifiedRegistration = {
  readonly credentialId: string;
  readonly publicKey: string;
  readonly counter: number;
  readonly transports: readonly string[];
  readonly backedUp: boolean;
};

export type VerifiedAuthentication = {
  readonly credentialId: string;
  readonly newCounter: number;
  readonly backedUp: boolean;
};

/* The WebAuthn layer behind an interface, so routes are testable with a fake
   and the real implementation is exercised end to end in the browser. */
export type PasskeyCeremonies = {
  readonly registrationOptions: (subject: RegistrationSubject) => Promise<CeremonyOptions>;
  readonly verifyRegistration: (
    response: unknown,
    expectedChallenge: string,
  ) => Promise<VerifiedRegistration | undefined>;
  readonly authenticationOptions: () => Promise<CeremonyOptions>;
  readonly verifyAuthentication: (
    response: unknown,
    expectedChallenge: string,
    passkey: PasskeyRecord,
  ) => Promise<VerifiedAuthentication | undefined>;
  /* The credential id inside an authentication response, before verification. */
  readonly credentialIdOf: (response: unknown) => string | undefined;
  /* The challenge echoed inside clientDataJSON, so the stored row can be
     looked up (and consumed) before verification. */
  readonly challengeOf: (response: unknown) => string | undefined;
};

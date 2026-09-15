export type PasskeyRecord = {
  /* Base64url credential id, as the browser reports it. */
  readonly credentialId: string;
  readonly accountId: number;
  /* Base64url COSE public key. */
  readonly publicKey: string;
  readonly counter: number;
  readonly transports: readonly string[];
  readonly backedUp: boolean;
  readonly label: string;
  readonly createdAt: number;
};

export type PasskeyStore = {
  readonly add: (passkey: PasskeyRecord) => Promise<void>;
  readonly find: (credentialId: string) => Promise<PasskeyRecord | undefined>;
  readonly listByAccount: (accountId: number) => Promise<readonly PasskeyRecord[]>;
  readonly updateCounter: (credentialId: string, counter: number, backedUp: boolean) => Promise<void>;
  /* Returns whether a passkey of that account was removed. */
  readonly remove: (accountId: number, credentialId: string) => Promise<boolean>;
};

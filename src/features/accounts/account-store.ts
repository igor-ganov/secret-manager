export type AccountRecord = {
  readonly id: number;
  readonly name: string;
};

export type NewAccount = AccountRecord & {
  /* WebAuthn user handle: random opaque bytes, base64url. */
  readonly userHandle: string;
  readonly recoveryHash: string;
  readonly createdAt: number;
};

export type AccountStore = {
  readonly create: (account: NewAccount) => Promise<void>;
  readonly get: (id: number) => Promise<AccountRecord | undefined>;
  readonly userHandleOf: (id: number) => Promise<string | undefined>;
  readonly findByRecoveryHash: (hash: string) => Promise<number | undefined>;
  readonly setRecoveryHash: (id: number, hash: string) => Promise<void>;
};

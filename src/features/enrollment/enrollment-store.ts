/* One-time links that let another device register a passkey for an account.
   Only the SHA-256 of the code is stored. */
export type EnrollmentStore = {
  readonly create: (codeHash: string, accountId: number, expiresAt: number) => Promise<void>;
  readonly peek: (codeHash: string) => Promise<number | undefined>;
  /* Removes the row and returns its account, or undefined when unknown/expired. */
  readonly consume: (codeHash: string) => Promise<number | undefined>;
};

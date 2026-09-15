export type ApiTokenRecord = {
  /* Hex SHA-256 of the token: identifies a row without revealing the token. */
  readonly id: string;
  readonly label: string;
  readonly createdAt: number;
};

export type ResolvedToken = {
  readonly userId: number;
  readonly id: string;
};

/* Only hashes are stored; the clear token exists in the `create` result alone. */
export type ApiTokenStore = {
  readonly create: (
    userId: number,
    label: string,
  ) => Promise<{ readonly token: string; readonly record: ApiTokenRecord }>;
  readonly resolve: (token: string) => Promise<ResolvedToken | undefined>;
  readonly list: (userId: number) => Promise<readonly ApiTokenRecord[]>;
  /* Returns whether a token owned by `userId` was revoked. */
  readonly revoke: (userId: number, id: string) => Promise<boolean>;
};

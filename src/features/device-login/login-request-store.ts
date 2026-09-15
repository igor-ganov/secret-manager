export type LoginRequestKind = 'cli' | 'telegram';

export type LoginRequestStatus = 'pending' | 'approved' | 'denied';

export type NewLoginRequest = {
  readonly codeHash: string;
  readonly pollHash: string;
  readonly kind: LoginRequestKind;
  readonly label: string;
  /* What is asking: the Telegram user id, or the CLI host name. */
  readonly subject: string;
  readonly expiresAt: number;
};

export type LoginRequestView = {
  readonly kind: LoginRequestKind;
  readonly label: string;
  readonly subject: string;
  readonly status: LoginRequestStatus;
};

export type PollResult =
  | { readonly status: 'pending' }
  | { readonly status: 'approved'; readonly token: string };

/* A device asks, the owner answers on the site. Two secrets: the code in the
   link (hashed) and the poll token only the device holds (hashed). */
export type LoginRequestStore = {
  readonly create: (request: NewLoginRequest) => Promise<void>;
  readonly peek: (codeHash: string) => Promise<LoginRequestView | undefined>;
  /* Marks a pending request approved; `issuedToken` is handed to the device once. */
  readonly approve: (codeHash: string, accountId: number, issuedToken: string | undefined) => Promise<boolean>;
  readonly deny: (codeHash: string) => Promise<boolean>;
  /* Undefined when unknown, expired or denied. Clears the token it returns. */
  readonly poll: (pollHash: string) => Promise<PollResult | undefined>;
};

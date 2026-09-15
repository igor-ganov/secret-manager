export type LoginRequestKind = 'cli' | 'telegram';

export type LoginRequestStatus = 'pending' | 'approved' | 'denied';

export type NewLoginRequest = {
  readonly codeHash: string;
  readonly pollHash: string;
  readonly kind: LoginRequestKind;
  readonly label: string;
  /* What is asking: the Telegram user id, or the CLI host name. */
  readonly subject: string;
  /* Loopback url the browser is sent to after approval; '' for none. */
  readonly callback: string;
  readonly expiresAt: number;
};

export type LoginRequestView = {
  readonly kind: LoginRequestKind;
  readonly label: string;
  readonly subject: string;
  readonly callback: string;
  readonly status: LoginRequestStatus;
  /* Short code the person can type into the device; '' until approved. */
  readonly grant: string;
};

/* A device asks, the owner answers on the site. Three secrets: the code in
   the link (hashed), the device secret only the device holds (hashed), and
   after approval the short grant, which only works with the device secret. */
export type LoginRequestStore = {
  readonly create: (request: NewLoginRequest) => Promise<void>;
  readonly peek: (codeHash: string) => Promise<LoginRequestView | undefined>;
  /* Marks a pending request approved; the token (if any) is claimable once. */
  readonly approve: (codeHash: string, accountId: number, issuedToken: string, grant: string) => Promise<boolean>;
  readonly deny: (codeHash: string) => Promise<boolean>;
  /* Hands the issued token to the device once; undefined when unknown,
     expired, denied, pending, wrong grant, or already claimed. */
  readonly claim: (pollHash: string, grant: string) => Promise<string | undefined>;
};

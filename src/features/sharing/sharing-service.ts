export type IssuedLink = {
  readonly url: string;
  readonly ttlMinutes: number;
};

/* Application service shared by every input port (Telegram bot, HTTP API): it
   owns the "resolve the user's lifetime → issue a link → build the url" flow
   so each client renders the same link the same way. */
export type SharingService = {
  /* One-time link to an unsaved value. */
  readonly share: (userId: number, value: string) => Promise<IssuedLink>;
  readonly save: (userId: number, key: string, value: string) => Promise<void>;
  readonly saveAndShare: (userId: number, key: string, value: string) => Promise<IssuedLink>;
  /* Fresh link to a stored value; undefined when the key does not exist. */
  readonly linkFor: (userId: number, key: string) => Promise<IssuedLink | undefined>;
  readonly read: (userId: number, key: string) => Promise<string | undefined>;
  readonly list: (userId: number) => Promise<readonly string[]>;
  readonly remove: (userId: number, key: string) => Promise<void>;
  readonly getTtlMinutes: (userId: number) => Promise<number>;
  readonly setTtlMinutes: (userId: number, minutes: number) => Promise<void>;
};

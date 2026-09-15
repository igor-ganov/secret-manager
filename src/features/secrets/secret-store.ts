export type SecretStore = {
  readonly save: (userId: number, key: string, value: string) => Promise<void>;
  readonly read: (userId: number, key: string) => Promise<string | undefined>;
  readonly list: (userId: number) => Promise<readonly string[]>;
  readonly remove: (userId: number, key: string) => Promise<void>;
  /* Moves every key of `fromUserId` to `toUserId` (legacy Telegram-id rows
     become account rows on first link); existing keys of the target win. */
  readonly reassign: (fromUserId: number, toUserId: number) => Promise<void>;
};

export type SettingsStore = {
  /* Returns the user's chosen link lifetime in minutes, or undefined when the
     user has never changed it — callers fall back to the global default. */
  readonly getTtlMinutes: (userId: number) => Promise<number | undefined>;
  readonly setTtlMinutes: (userId: number, minutes: number) => Promise<void>;
  /* Moves a legacy Telegram-id row to an account; an existing account row wins. */
  readonly reassign: (fromUserId: number, toUserId: number) => Promise<void>;
};

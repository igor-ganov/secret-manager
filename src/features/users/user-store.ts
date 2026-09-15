/* Display names come from the Telegram login payload; the bot never needs
   them, so they are recorded at web login and only read back by `/api/me`. */
export type UserStore = {
  readonly saveName: (userId: number, name: string) => Promise<void>;
  readonly getName: (userId: number) => Promise<string | undefined>;
};

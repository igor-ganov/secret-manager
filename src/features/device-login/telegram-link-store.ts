/* Which account a Telegram chat acts for. A chat is linked by approving a
   login request on the site and unlinked with /logout. */
export type TelegramLinkStore = {
  readonly accountFor: (telegramUserId: number) => Promise<number | undefined>;
  readonly telegramUserFor: (accountId: number) => Promise<number | undefined>;
  readonly link: (telegramUserId: number, accountId: number, linkedAt: number) => Promise<void>;
  readonly unlink: (telegramUserId: number) => Promise<void>;
};

const TELEGRAM_OAUTH = 'https://oauth.telegram.org/auth';

/* The redirect flow behind Telegram's login widget, without its script:
   Telegram returns to `return_to` with `#tgAuthResult=<base64url json>`. */
export const buildTelegramLoginUrl = (botId: number, origin: string): string => {
  const query = new URLSearchParams({
    bot_id: String(botId),
    origin,
    request_access: 'write',
    return_to: `${origin}/`,
  });
  return `${TELEGRAM_OAUTH}?${query}`;
};

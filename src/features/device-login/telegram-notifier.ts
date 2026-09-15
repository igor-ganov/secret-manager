export type TelegramNotifier = (chatId: number, text: string) => Promise<void>;

/* Plain Bot API call (no grammY instance needed on the API side); failures
   are logged, never surfaced, because the link itself already succeeded. */
export const createTelegramNotifier =
  (botToken: string, fetchFn: typeof fetch = fetch): TelegramNotifier =>
  async (chatId, text) => {
    try {
      await fetchFn(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    } catch (error) {
      console.error('Failed to notify Telegram chat:', error);
    }
  };

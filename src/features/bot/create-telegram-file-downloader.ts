import type { Bytes } from '../secret-files/upload-in-parts.ts';

const FILE_API = 'https://api.telegram.org/file/bot';

/* Fetches a file the Bot API's getFile resolved to `filePath` (secret-files
   AC-7.1). The url carries the bot token, so it is never logged. */
export const createTelegramFileDownloader =
  (token: string) =>
  async (filePath: string): Promise<Bytes> => {
    const response = await fetch(`${FILE_API}${token}/${filePath}`);
    if (!response.ok) {
      throw new Error(`Telegram file download failed (${String(response.status)}).`);
    }
    return new Uint8Array(await response.arrayBuffer());
  };

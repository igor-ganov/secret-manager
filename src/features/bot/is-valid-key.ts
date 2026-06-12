/* Telegram callback data is limited to 64 bytes; 2 bytes are used by the action prefix. */
const MAX_KEY_BYTES = 62;

const encoder = new TextEncoder();

export const isValidKey = (key: string): boolean =>
  key !== '' && encoder.encode(key).byteLength <= MAX_KEY_BYTES;

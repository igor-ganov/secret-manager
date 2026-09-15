/* Telegram callback data is limited to 64 bytes; 2 bytes are used by the action
   prefix. The store is shared by every client, so the cap applies everywhere.
   Whitespace is excluded because "key value" input splits on it. */
const MAX_KEY_BYTES = 62;

const encoder = new TextEncoder();

export const isValidKey = (key: string): boolean =>
  key !== '' && !/\s/.test(key) && encoder.encode(key).byteLength <= MAX_KEY_BYTES;

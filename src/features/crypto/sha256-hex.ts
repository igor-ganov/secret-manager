import { toHex } from './to-hex.ts';

const encoder = new TextEncoder();

/* WebCrypto runs unchanged on Bun and Cloudflare Workers. */
export const sha256Hex = async (text: string): Promise<string> =>
  toHex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));

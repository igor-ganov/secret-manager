import { toHex } from './to-hex.ts';

const encoder = new TextEncoder();

export const hmacSha256Hex = async (key: ArrayBuffer, message: string): Promise<string> => {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message)));
};

const toBinary = (bytes: Uint8Array): string => Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

export const toBase64url = (bytes: Uint8Array): string =>
  btoa(toBinary(bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

/* Returns a view over a plain ArrayBuffer (never a SharedArrayBuffer), which
   is what WebCrypto and the WebAuthn library expect. */
export const fromBase64url = (text: string): Uint8Array<ArrayBuffer> => {
  const standard = text.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(`${standard}${'='.repeat((4 - (standard.length % 4)) % 4)}`);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  Array.from(binary).forEach((character, index) => {
    bytes[index] = character.charCodeAt(0);
  });
  return bytes;
};

export const randomBase64url = (byteLength: number): string =>
  toBase64url(crypto.getRandomValues(new Uint8Array(byteLength)));

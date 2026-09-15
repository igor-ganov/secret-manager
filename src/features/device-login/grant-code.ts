/* Short code typed by hand when the browser cannot reach the device; it is
   only useful together with the device secret, so 8 characters suffice. */
const ALPHABET = 'abcdefghjkmnpqrstvwxyz23456789';
const LENGTH = 8;

export const createGrantCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(LENGTH));
  const characters = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length] ?? 'a');
  return `${characters.slice(0, 4).join('')}-${characters.slice(4).join('')}`;
};

export const normalizeGrantCode = (typed: string): string => {
  const plain = typed.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${plain.slice(0, 4)}-${plain.slice(4, 8)}`;
};

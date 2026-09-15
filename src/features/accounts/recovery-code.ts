/* 128-bit recovery codes as grouped base32 (Crockford-like alphabet without
   ambiguous letters), e.g. "k7m2-9x4p-…"; normalised before hashing so
   case and separators typed by the user do not matter. */
const ALPHABET = 'abcdefghjkmnpqrstvwxyz23456789';
const GROUPS = 7;
const GROUP_LENGTH = 4;

export const createRecoveryCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(GROUPS * GROUP_LENGTH));
  const characters = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length] ?? 'a');
  return Array.from({ length: GROUPS }, (_, group) =>
    characters.slice(group * GROUP_LENGTH, (group + 1) * GROUP_LENGTH).join(''),
  ).join('-');
};

export const normalizeRecoveryCode = (typed: string): string =>
  typed.toLowerCase().replace(/[^a-z0-9]/g, '');

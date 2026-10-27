/* RFC 5987 attr-char: what may stay unescaped in `filename*`. encodeURIComponent
   leaves ' ( ) * as they are, so those are escaped by hand. */
const encodeRfc5987 = (value: string): string =>
  encodeURIComponent(value).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

/* Printable ASCII without the quote and the backslash, for the quoted
   `filename` that old clients read. */
const asciiFallback = (name: string): string => name.replace(/[^\x20-\x7e]|["\\]/g, '_');

/* RFC 6266 attachment with both forms: browsers and `curl -OJ` prefer
   `filename*`, so non-ASCII names survive the trip. */
export const attachmentDisposition = (name: string): string =>
  `attachment; filename="${asciiFallback(name)}"; filename*=UTF-8''${encodeRfc5987(name)}`;

const PADDING = ['', '', '==', '='] as const;

/* Telegram base64url-encodes the login result without padding. */
export const decodeBase64url = (encoded: string): string => {
  const standard = encoded.replaceAll('-', '+').replaceAll('_', '/');
  const padded = `${standard}${PADDING[standard.length % 4] ?? ''}`;
  return globalThis.atob(padded);
};

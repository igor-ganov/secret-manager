const REPLACEMENTS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
} as const;

const isEscapable = (character: string): character is keyof typeof REPLACEMENTS =>
  character in REPLACEMENTS;

export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (character) =>
    isEscapable(character) ? REPLACEMENTS[character] : character,
  );

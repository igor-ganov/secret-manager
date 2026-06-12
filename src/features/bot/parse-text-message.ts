export type ParsedTextMessage =
  | { readonly kind: 'pair'; readonly key: string; readonly value: string }
  | { readonly kind: 'single'; readonly value: string }
  | { readonly kind: 'empty' };

export const parseTextMessage = (text: string): ParsedTextMessage => {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { kind: 'empty' };
  }
  const separatorIndex = trimmed.search(/\s/);
  if (separatorIndex === -1) {
    return { kind: 'single', value: trimmed };
  }
  return {
    kind: 'pair',
    key: trimmed.slice(0, separatorIndex),
    value: trimmed.slice(separatorIndex).trim(),
  };
};

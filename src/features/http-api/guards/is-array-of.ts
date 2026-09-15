export const isArrayOf =
  <T>(isItem: (value: unknown) => value is T) =>
  (value: unknown): value is readonly T[] =>
    Array.isArray(value) && value.every(isItem);

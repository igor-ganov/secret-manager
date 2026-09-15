import type { Decoder } from './decoder.ts';

/* Lifts a type guard into a decoder without a branch. */
export const decodeWith =
  <T>(guard: (value: unknown) => value is T): Decoder<T> =>
  (body) =>
    [body].find(guard);

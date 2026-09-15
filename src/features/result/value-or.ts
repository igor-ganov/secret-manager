import { matchResult } from './match-result.ts';
import type { Result } from './result.ts';

export const valueOr = <T, E>(result: Result<T, E>, fallback: T): T =>
  matchResult(
    result,
    (value) => value,
    () => fallback,
  );

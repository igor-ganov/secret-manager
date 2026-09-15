import type { Result } from './result.ts';

export const matchResult = <T, E, R>(
  result: Result<T, E>,
  onOk: (value: T) => R,
  onError: (error: E) => R,
): R => {
  switch (result.ok) {
    case true:
      return onOk(result.value);
    case false:
      return onError(result.error);
  }
};

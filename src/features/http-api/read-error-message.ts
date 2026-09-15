import { isRecord } from './guards/is-record.ts';
import { isString } from './guards/is-string.ts';

const hasError = (value: unknown): value is { readonly error: string } =>
  isRecord(value) && isString(value['error']);

export const readErrorMessage = (body: unknown, status: number): string =>
  [body].find(hasError)?.error ?? `Request failed (${status}).`;

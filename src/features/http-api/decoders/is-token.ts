import type { TokenResponse } from '../api-types.ts';
import { isBoolean } from '../guards/is-boolean.ts';
import { isNumber } from '../guards/is-number.ts';
import { isRecord } from '../guards/is-record.ts';
import { isString } from '../guards/is-string.ts';

export const isToken = (value: unknown): value is TokenResponse =>
  isRecord(value) &&
  isString(value['id']) &&
  isString(value['label']) &&
  isNumber(value['createdAt']) &&
  isBoolean(value['current']);

import type { KeysResponse } from '../api-types.ts';
import { isArrayOf } from '../guards/is-array-of.ts';
import { isRecord } from '../guards/is-record.ts';
import { isString } from '../guards/is-string.ts';
import { decodeWith } from './decode-with.ts';

const isKeys = (value: unknown): value is KeysResponse =>
  isRecord(value) && isArrayOf(isString)(value['keys']);

export const decodeKeys = decodeWith(isKeys);

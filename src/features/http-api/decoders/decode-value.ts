import type { ValueResponse } from '../api-types.ts';
import { isRecord } from '../guards/is-record.ts';
import { isString } from '../guards/is-string.ts';
import { decodeWith } from './decode-with.ts';

const isValue = (value: unknown): value is ValueResponse =>
  isRecord(value) && isString(value['value']);

export const decodeValue = decodeWith(isValue);

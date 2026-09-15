import type { MeResponse } from '../api-types.ts';
import { isNumber } from '../guards/is-number.ts';
import { isRecord } from '../guards/is-record.ts';
import { isString } from '../guards/is-string.ts';
import { decodeWith } from './decode-with.ts';

const isMe = (value: unknown): value is MeResponse =>
  isRecord(value) && isNumber(value['id']) && isString(value['name']);

export const decodeMe = decodeWith(isMe);

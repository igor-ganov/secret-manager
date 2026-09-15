import type { CreatedTokenResponse } from '../api-types.ts';
import { isRecord } from '../guards/is-record.ts';
import { isString } from '../guards/is-string.ts';
import { decodeWith } from './decode-with.ts';
import { isToken } from './is-token.ts';

const isCreatedToken = (value: unknown): value is CreatedTokenResponse =>
  isRecord(value) && isString(value['token']) && isToken(value);

export const decodeCreatedToken = decodeWith(isCreatedToken);

import type { TokensResponse } from '../api-types.ts';
import { isArrayOf } from '../guards/is-array-of.ts';
import { isRecord } from '../guards/is-record.ts';
import { decodeWith } from './decode-with.ts';
import { isToken } from './is-token.ts';

const isTokens = (value: unknown): value is TokensResponse =>
  isRecord(value) && isArrayOf(isToken)(value['tokens']);

export const decodeTokens = decodeWith(isTokens);

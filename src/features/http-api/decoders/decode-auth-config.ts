import type { AuthConfigResponse } from '../api-types.ts';
import { isNumber } from '../guards/is-number.ts';
import { isRecord } from '../guards/is-record.ts';
import { decodeWith } from './decode-with.ts';

const isAuthConfig = (value: unknown): value is AuthConfigResponse =>
  isRecord(value) && isNumber(value['botId']);

export const decodeAuthConfig = decodeWith(isAuthConfig);

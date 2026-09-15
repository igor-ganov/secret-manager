import type { IssuedLinkResponse } from '../api-types.ts';
import { isNumber } from '../guards/is-number.ts';
import { isRecord } from '../guards/is-record.ts';
import { isString } from '../guards/is-string.ts';
import { decodeWith } from './decode-with.ts';

const isIssuedLink = (value: unknown): value is IssuedLinkResponse =>
  isRecord(value) && isString(value['url']) && isString(value['curl']) && isNumber(value['ttlMinutes']);

export const decodeIssuedLink = decodeWith(isIssuedLink);

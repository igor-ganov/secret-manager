import type { SignedInResponse } from '../api-types.ts';
import { isNumber } from '../guards/is-number.ts';
import { isRecord } from '../guards/is-record.ts';
import { isString } from '../guards/is-string.ts';
import { decodeWith } from './decode-with.ts';

const isSignedIn = (value: unknown): value is SignedInResponse =>
  isRecord(value) &&
  isNumber(value['id']) &&
  isString(value['name']) &&
  (value['recoveryCode'] === undefined || isString(value['recoveryCode']));

export const decodeSignedIn = decodeWith(isSignedIn);

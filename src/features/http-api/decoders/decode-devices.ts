import type { DevicesResponse, PasskeyResponse } from '../api-types.ts';
import { isArrayOf } from '../guards/is-array-of.ts';
import { isBoolean } from '../guards/is-boolean.ts';
import { isNumber } from '../guards/is-number.ts';
import { isRecord } from '../guards/is-record.ts';
import { isString } from '../guards/is-string.ts';
import { decodeWith } from './decode-with.ts';
import { isToken } from './is-token.ts';

const isPasskey = (value: unknown): value is PasskeyResponse =>
  isRecord(value) &&
  isString(value['id']) &&
  isString(value['label']) &&
  isNumber(value['createdAt']) &&
  isBoolean(value['backedUp']);

const isTelegram = (value: unknown): value is DevicesResponse['telegram'] =>
  isRecord(value) && isBoolean(value['linked']);

const isDevices = (value: unknown): value is DevicesResponse =>
  isRecord(value) &&
  isArrayOf(isPasskey)(value['passkeys']) &&
  isTelegram(value['telegram']) &&
  isArrayOf(isToken)(value['tokens']);

export const decodeDevices = decodeWith(isDevices);

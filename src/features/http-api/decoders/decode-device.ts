import type { DevicePollResponse, DeviceStartResponse, LoginRequestInfoResponse } from '../api-types.ts';
import { isNumber } from '../guards/is-number.ts';
import { isRecord } from '../guards/is-record.ts';
import { isString } from '../guards/is-string.ts';
import { decodeWith } from './decode-with.ts';

const isDeviceStart = (value: unknown): value is DeviceStartResponse =>
  isRecord(value) && isString(value['url']) && isString(value['pollToken']) && isNumber(value['expiresAt']);

const isDevicePoll = (value: unknown): value is DevicePollResponse =>
  isRecord(value) &&
  (value['status'] === 'pending' || (value['status'] === 'approved' && isString(value['token'])));

const isLoginRequestInfo = (value: unknown): value is LoginRequestInfoResponse =>
  isRecord(value) && (value['kind'] === 'cli' || value['kind'] === 'telegram') && isString(value['label']);

export const decodeDeviceStart = decodeWith(isDeviceStart);

export const decodeDevicePoll = decodeWith(isDevicePoll);

export const decodeLoginRequestInfo = decodeWith(isLoginRequestInfo);

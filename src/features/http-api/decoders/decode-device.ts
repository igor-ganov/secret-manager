import type { DeviceApprovalResponse, DeviceClaimResponse, DeviceStartResponse, LoginRequestInfoResponse } from '../api-types.ts';
import { isNumber } from '../guards/is-number.ts';
import { isRecord } from '../guards/is-record.ts';
import { isString } from '../guards/is-string.ts';
import { decodeWith } from './decode-with.ts';

const isKind = (value: unknown): boolean => value === 'cli' || value === 'telegram';
const isStatus = (value: unknown): boolean => value === 'pending' || value === 'approved' || value === 'denied';

const isDeviceStart = (value: unknown): value is DeviceStartResponse =>
  isRecord(value) && isString(value['url']) && isString(value['deviceSecret']) && isNumber(value['expiresAt']);

const isDeviceApproval = (value: unknown): value is DeviceApprovalResponse =>
  isRecord(value) && isKind(value['kind']) && isString(value['grant']) && isString(value['callback']);

const isDeviceClaim = (value: unknown): value is DeviceClaimResponse => isRecord(value) && isString(value['token']);

const isLoginRequestInfo = (value: unknown): value is LoginRequestInfoResponse =>
  isRecord(value) &&
  isKind(value['kind']) &&
  isString(value['label']) &&
  isStatus(value['status']) &&
  isString(value['grant']) &&
  isString(value['callback']);

export const decodeDeviceStart = decodeWith(isDeviceStart);

export const decodeDeviceApproval = decodeWith(isDeviceApproval);

export const decodeDeviceClaim = decodeWith(isDeviceClaim);

export const decodeLoginRequestInfo = decodeWith(isLoginRequestInfo);

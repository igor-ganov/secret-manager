import type { EnrollmentInfoResponse, EnrollmentResponse } from '../api-types.ts';
import { isNumber } from '../guards/is-number.ts';
import { isRecord } from '../guards/is-record.ts';
import { isString } from '../guards/is-string.ts';
import { decodeWith } from './decode-with.ts';

const isEnrollment = (value: unknown): value is EnrollmentResponse =>
  isRecord(value) && isString(value['url']) && isString(value['qr']) && isNumber(value['expiresAt']);

const isEnrollmentInfo = (value: unknown): value is EnrollmentInfoResponse =>
  isRecord(value) && isString(value['accountName']);

export const decodeEnrollment = decodeWith(isEnrollment);

export const decodeEnrollmentInfo = decodeWith(isEnrollmentInfo);

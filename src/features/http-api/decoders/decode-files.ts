import type { LinkInfoResponse, UploadTicketResponse } from '../api-types.ts';
import { isNumber } from '../guards/is-number.ts';
import { isRecord } from '../guards/is-record.ts';
import { isString } from '../guards/is-string.ts';
import { decodeWith } from './decode-with.ts';

const isUploadTicket = (value: unknown): value is UploadTicketResponse =>
  isRecord(value) &&
  isString(value['uploadId']) &&
  isNumber(value['partSize']) &&
  isNumber(value['partCount']) &&
  isNumber(value['expiresAt']);

const isLinkInfo = (value: unknown): value is LinkInfoResponse =>
  isRecord(value) &&
  (value['kind'] === 'text' || (value['kind'] === 'file' && isString(value['name']) && isNumber(value['size'])));

export const decodeUploadTicket = decodeWith(isUploadTicket);

export const decodeLinkInfo = decodeWith(isLinkInfo);

import { decodeEmpty } from '../../features/http-api/decoders/decode-empty.ts';
import { decodeUploadTicket } from '../../features/http-api/decoders/decode-files.ts';
import { decodeIssuedLink } from '../../features/http-api/decoders/decode-issued-link.ts';
import type { BytesSender } from './create-bytes-sender.ts';
import type { JsonRequester } from './create-json-requester.ts';
import type { FileApi } from './file-api.ts';

const uploadPath = (uploadId: string): string => `/api/uploads/${encodeURIComponent(uploadId)}`;

export const createFileApi = (request: JsonRequester, sendBytes: BytesSender): FileApi => ({
  beginFile: (name, size, contentType) => request('POST', '/api/files', decodeUploadTicket, { name, size, contentType }),
  dropFile: (name, size, contentType, ttlMinutes) =>
    request('POST', '/api/file-drops', decodeUploadTicket, { name, size, contentType, ttlMinutes }),
  putPart: (uploadId, partNumber, bytes) => sendBytes('PUT', `${uploadPath(uploadId)}/parts/${String(partNumber)}`, bytes),
  completeUpload: (uploadId) => request('POST', `${uploadPath(uploadId)}/complete`, decodeIssuedLink),
  abortUpload: (uploadId) => request('DELETE', uploadPath(uploadId), decodeEmpty),
});

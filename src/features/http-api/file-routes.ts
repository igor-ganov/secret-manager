import { isValidDropTtl } from '../sharing/drop-limits.ts';
import { buildFileCurlSnippet } from '../sharing/build-file-curl-snippet.ts';
import { FILE_PART_BYTES } from '../secret-files/file-limits.ts';
import type { FileFailure, FileOwner, FileResult, FileSharingService, FileUploadRequest, UploadTicket } from '../secret-files/file-sharing-service.ts';
import type { UploadTicketResponse } from './api-types.ts';
import { DROP_TTL_ERROR } from './drop-routes.ts';
import { badRequest, errorResponse, jsonResponse, noContent, notFound } from './json-response.ts';
import { linkResponse } from './link-response.ts';
import { readJsonObject, readNumber, readString, type JsonObject } from './read-json-object.ts';
import type { Route } from './route.ts';

const REQUEST_ERROR = 'Send JSON { name, size, contentType? }; size is a whole number of bytes.';
const MISSING_UPLOAD = 'No such upload: it finished, was aborted or expired.';
const PART_TOO_LARGE = `A part is at most ${String(FILE_PART_BYTES)} bytes.`;

const readUploadRequest = (body: JsonObject | undefined): FileUploadRequest | undefined => {
  if (body === undefined) {
    return undefined;
  }
  const name = readString(body, 'name');
  const size = readNumber(body, 'size');
  return name === undefined || size === undefined ? undefined : { name, size, contentType: readString(body, 'contentType') ?? '' };
};

const failureResponse = (failure: FileFailure): Response => {
  switch (failure.kind) {
    case 'invalid':
      return badRequest(failure.message);
    case 'missing':
      return notFound(MISSING_UPLOAD);
  }
};

const respond = <T>(result: FileResult<T>, onOk: (value: T) => Response): Response =>
  result.ok ? onOk(result.value) : failureResponse(result.error);

const ticketResponse = (ticket: UploadTicket): Response => {
  const body: UploadTicketResponse = ticket;
  return jsonResponse(body, 201);
};

const begin = async (files: FileSharingService, owner: FileOwner, body: JsonObject | undefined): Promise<Response> => {
  const request = readUploadRequest(body);
  return request === undefined ? badRequest(REQUEST_ERROR) : respond(await files.begin(owner, request), ticketResponse);
};

const uploadIdOf = (params: Readonly<Record<string, string>>): string => params['uploadId'] ?? '';

/* A declared length above one part is refused before the body is read. */
const readPart = async (request: Request): Promise<Uint8Array | undefined> => {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > FILE_PART_BYTES) {
    return undefined;
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  return bytes.byteLength > FILE_PART_BYTES ? undefined : bytes;
};

/* Chunked upload of a secret file (secret-files design §3). The part,
   complete and abort routes are public: the 256-bit upload id is the
   credential, and the dispatcher still applies the cookie CSRF gate. */
export const createFileRoutes = (files: FileSharingService): readonly Route[] => [
  {
    method: 'POST',
    pattern: '/api/files',
    auth: 'user',
    handle: async ({ request, principal }) => begin(files, { kind: 'user', userId: principal.userId }, await readJsonObject(request)),
  },
  {
    method: 'POST',
    pattern: '/api/file-drops',
    auth: 'none',
    limited: true,
    handle: async ({ request }) => {
      const body = await readJsonObject(request);
      const ttlMinutes = body === undefined ? undefined : readNumber(body, 'ttlMinutes');
      return ttlMinutes === undefined || !isValidDropTtl(ttlMinutes) ? badRequest(DROP_TTL_ERROR) : begin(files, { kind: 'drop', ttlMinutes }, body);
    },
  },
  {
    method: 'PUT',
    pattern: '/api/uploads/:uploadId/parts/:partNumber',
    auth: 'none',
    handle: async ({ request, params }) => {
      const bytes = await readPart(request);
      return bytes === undefined
        ? errorResponse(413, PART_TOO_LARGE)
        : respond(await files.putPart(uploadIdOf(params), Number(params['partNumber']), bytes), () => noContent());
    },
  },
  {
    method: 'POST',
    pattern: '/api/uploads/:uploadId/complete',
    auth: 'none',
    handle: async ({ params }) => respond(await files.complete(uploadIdOf(params)), (link) => linkResponse(link, buildFileCurlSnippet)),
  },
  {
    method: 'DELETE',
    pattern: '/api/uploads/:uploadId',
    auth: 'none',
    handle: async ({ params }) => ((await files.abort(uploadIdOf(params))) ? noContent() : notFound(MISSING_UPLOAD)),
  },
];

import { DROP_MAX_TTL_MINUTES, DROP_MAX_VALUE_BYTES, isValidDropTtl, isValidDropValue } from '../sharing/drop-limits.ts';
import type { SharingService } from '../sharing/sharing-service.ts';
import { badRequest } from './json-response.ts';
import { linkResponse } from './link-response.ts';
import { readJsonObject, readNumber, readString, type JsonObject } from './read-json-object.ts';
import type { Route } from './route.ts';

export const DROP_VALUE_ERROR = `Value must be a non-empty string of at most ${String(DROP_MAX_VALUE_BYTES)} bytes.`;
export const DROP_TTL_ERROR = `ttlMinutes must be a whole number between 1 and ${String(DROP_MAX_TTL_MINUTES)}.`;

type DropInput =
  | { readonly kind: 'invalid'; readonly error: string }
  | { readonly kind: 'valid'; readonly value: string; readonly ttlMinutes: number };

const readDropInput = (body: JsonObject | undefined): DropInput => {
  const value = body === undefined ? undefined : readString(body, 'value');
  if (value === undefined || !isValidDropValue(value)) {
    return { kind: 'invalid', error: DROP_VALUE_ERROR };
  }
  const ttlMinutes = body === undefined ? undefined : readNumber(body, 'ttlMinutes');
  if (ttlMinutes === undefined || !isValidDropTtl(ttlMinutes)) {
    return { kind: 'invalid', error: DROP_TTL_ERROR };
  }
  return { kind: 'valid', value, ttlMinutes };
};

/* A drop needs no account: an assistant or a script turns a value into a
   one-time link with the lifetime it asks for. Public, hence rate-limited. */
export const createDropRoutes = (sharing: SharingService): readonly Route[] => [
  {
    method: 'POST',
    pattern: '/api/drops',
    auth: 'none',
    limited: true,
    handle: async ({ request }) => {
      const input = readDropInput(await readJsonObject(request));
      switch (input.kind) {
        case 'invalid':
          return badRequest(input.error);
        case 'valid':
          return linkResponse(await sharing.drop(input.value, input.ttlMinutes));
      }
    },
  },
];

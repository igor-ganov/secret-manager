import { buildCurlSnippet } from '../sharing/build-curl-snippet.ts';
import { isValidKey } from '../sharing/is-valid-key.ts';
import type { IssuedLink, SharingService } from '../sharing/sharing-service.ts';
import type { IssuedLinkResponse, KeysResponse, ValueResponse } from './api-types.ts';
import { badRequest, jsonResponse, noContent, notFound } from './json-response.ts';
import { readJsonObject, readString } from './read-json-object.ts';
import type { Route } from './route.ts';

export const KEY_ERROR = 'Key must be 1–62 bytes without whitespace.';
const VALUE_ERROR = 'Value must be a non-empty string.';
const MISSING_KEY = 'No such key.';

const linkResponse = (link: IssuedLink): Response => {
  const body: IssuedLinkResponse = { ...link, curl: buildCurlSnippet(link.url) };
  return jsonResponse(body, 201);
};

const readValue = async (request: Request): Promise<string | undefined> => {
  const body = await readJsonObject(request);
  const value = body === undefined ? undefined : readString(body, 'value');
  return value === undefined || value === '' ? undefined : value;
};

type ShareInput =
  | { readonly kind: 'invalid'; readonly error: string }
  | { readonly kind: 'unsaved'; readonly value: string }
  | { readonly kind: 'saved'; readonly key: string; readonly value: string };

const readShareInput = async (request: Request): Promise<ShareInput> => {
  const body = await readJsonObject(request);
  const value = body === undefined ? undefined : readString(body, 'value');
  if (value === undefined || value === '') {
    return { kind: 'invalid', error: VALUE_ERROR };
  }
  const key = body === undefined ? undefined : readString(body, 'key');
  if (key === undefined || key === '') {
    return { kind: 'unsaved', value };
  }
  return isValidKey(key) ? { kind: 'saved', key, value } : { kind: 'invalid', error: KEY_ERROR };
};

const keyOf = (params: Readonly<Record<string, string>>): string => params['key'] ?? '';

export const createSecretRoutes = (sharing: SharingService): readonly Route[] => [
  {
    method: 'POST',
    pattern: '/api/links',
    auth: 'user',
    handle: async ({ request, principal }) => {
      const input = await readShareInput(request);
      switch (input.kind) {
        case 'invalid':
          return badRequest(input.error);
        case 'unsaved':
          return linkResponse(await sharing.share(principal.userId, input.value));
        case 'saved':
          return linkResponse(await sharing.saveAndShare(principal.userId, input.key, input.value));
      }
    },
  },
  {
    method: 'GET',
    pattern: '/api/secrets',
    auth: 'user',
    handle: async ({ principal }) => {
      const body: KeysResponse = { keys: await sharing.list(principal.userId) };
      return jsonResponse(body);
    },
  },
  {
    method: 'GET',
    pattern: '/api/secrets/:key',
    auth: 'user',
    handle: async ({ params, principal }) => {
      const value = await sharing.read(principal.userId, keyOf(params));
      if (value === undefined) {
        return notFound(MISSING_KEY);
      }
      const body: ValueResponse = { value };
      return jsonResponse(body);
    },
  },
  {
    method: 'PUT',
    pattern: '/api/secrets/:key',
    auth: 'user',
    handle: async ({ request, params, principal }) => {
      const key = keyOf(params);
      if (!isValidKey(key)) {
        return badRequest(KEY_ERROR);
      }
      const value = await readValue(request);
      if (value === undefined) {
        return badRequest(VALUE_ERROR);
      }
      await sharing.save(principal.userId, key, value);
      return noContent();
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/secrets/:key',
    auth: 'user',
    handle: async ({ params, principal }) => {
      await sharing.remove(principal.userId, keyOf(params));
      return noContent();
    },
  },
  {
    method: 'POST',
    pattern: '/api/secrets/:key/link',
    auth: 'user',
    handle: async ({ params, principal }) => {
      const link = await sharing.linkFor(principal.userId, keyOf(params));
      return link === undefined ? notFound(MISSING_KEY) : linkResponse(link);
    },
  },
];

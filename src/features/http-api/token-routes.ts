import type { ApiTokenRecord, ApiTokenStore } from '../api-tokens/api-token-store.ts';
import type { CreatedTokenResponse, TokenResponse, TokensResponse } from './api-types.ts';
import { badRequest, jsonResponse, noContent, notFound } from './json-response.ts';
import { readJsonObject, readString } from './read-json-object.ts';
import type { Route } from './route.ts';

const MAX_LABEL_LENGTH = 64;

const toResponse = (record: ApiTokenRecord, currentId: string): TokenResponse => ({
  ...record,
  current: record.id === currentId,
});

const readLabel = async (request: Request): Promise<string | undefined> => {
  const body = await readJsonObject(request);
  const label = body === undefined ? undefined : readString(body, 'label')?.trim();
  return label === undefined || label === '' || label.length > MAX_LABEL_LENGTH ? undefined : label;
};

export const createTokenRoutes = (tokens: ApiTokenStore): readonly Route[] => [
  {
    method: 'GET',
    pattern: '/api/tokens',
    auth: 'user',
    handle: async ({ principal }) => {
      const records = await tokens.list(principal.userId);
      const body: TokensResponse = {
        tokens: records.map((record) => toResponse(record, principal.tokenId)),
      };
      return jsonResponse(body);
    },
  },
  {
    method: 'POST',
    pattern: '/api/tokens',
    auth: 'user',
    handle: async ({ request, principal }) => {
      const label = await readLabel(request);
      if (label === undefined) {
        return badRequest(`Label must be 1–${MAX_LABEL_LENGTH} characters.`);
      }
      const { token, record } = await tokens.create(principal.userId, label);
      const body: CreatedTokenResponse = { ...toResponse(record, principal.tokenId), token };
      return jsonResponse(body, 201);
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/tokens/:id',
    auth: 'user',
    handle: async ({ params, principal }) =>
      (await tokens.revoke(principal.userId, params['id'] ?? ''))
        ? noContent()
        : notFound('No such token.'),
  },
];

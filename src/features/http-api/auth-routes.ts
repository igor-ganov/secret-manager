import type { AccountStore } from '../accounts/account-store.ts';
import type { ApiTokenStore } from '../api-tokens/api-token-store.ts';
import type { MeResponse } from './api-types.ts';
import { jsonResponse, noContent } from './json-response.ts';
import type { Route } from './route.ts';
import { buildClearedSessionCookie, isSecureRequest } from './session-cookie.ts';

export type AuthRouteDependencies = {
  readonly tokens: ApiTokenStore;
  readonly accounts: AccountStore;
};

export const createAuthRoutes = ({ tokens, accounts }: AuthRouteDependencies): readonly Route[] => [
  {
    method: 'POST',
    pattern: '/api/auth/logout',
    auth: 'user',
    handle: async ({ request, principal }) => {
      await tokens.revoke(principal.userId, principal.tokenId);
      return noContent({ 'set-cookie': buildClearedSessionCookie(isSecureRequest(request)) });
    },
  },
  {
    method: 'GET',
    pattern: '/api/me',
    auth: 'user',
    handle: async ({ principal }) => {
      const body: MeResponse = {
        id: principal.userId,
        name: (await accounts.get(principal.userId))?.name ?? 'Account',
      };
      return jsonResponse(body);
    },
  },
];

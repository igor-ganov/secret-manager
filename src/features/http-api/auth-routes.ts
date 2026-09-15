import type { ApiTokenStore } from '../api-tokens/api-token-store.ts';
import { parseTelegramLoginPayload } from '../telegram-auth/telegram-login-payload.ts';
import type { TelegramLoginVerification } from '../telegram-auth/verify-telegram-login.ts';
import type { TelegramLoginPayload } from '../telegram-auth/telegram-login-payload.ts';
import type { UserStore } from '../users/user-store.ts';
import type { AuthConfigResponse, MeResponse } from './api-types.ts';
import { badRequest, jsonResponse, noContent, unauthorized } from './json-response.ts';
import { readJsonObject } from './read-json-object.ts';
import type { Route } from './route.ts';
import { buildClearedSessionCookie, buildSessionCookie, isSecureRequest } from './session-cookie.ts';

export type AuthRouteDependencies = {
  readonly tokens: ApiTokenStore;
  readonly users: UserStore;
  readonly verifyLogin: (payload: TelegramLoginPayload) => Promise<TelegramLoginVerification>;
  readonly botId: number;
};

const WEB_SESSION_LABEL = 'web';

const LOGIN_ERRORS = {
  'bad-signature': 'Telegram login could not be verified.',
  expired: 'Telegram login has expired, please log in again.',
} as const;

export const createAuthRoutes = ({
  tokens,
  users,
  verifyLogin,
  botId,
}: AuthRouteDependencies): readonly Route[] => [
  {
    method: 'GET',
    pattern: '/api/auth/config',
    auth: 'none',
    handle: async () => {
      const body: AuthConfigResponse = { botId };
      return jsonResponse(body);
    },
  },
  {
    method: 'POST',
    pattern: '/api/auth/telegram',
    auth: 'none',
    handle: async ({ request }) => {
      const payload = parseTelegramLoginPayload(await readJsonObject(request));
      if (payload === undefined) {
        return badRequest('Expected the Telegram login payload.');
      }
      const verification = await verifyLogin(payload);
      if (!verification.ok) {
        return unauthorized(LOGIN_ERRORS[verification.reason]);
      }
      const { user } = verification;
      await users.saveName(user.id, user.name);
      const { token } = await tokens.create(user.id, WEB_SESSION_LABEL);
      const body: MeResponse = { id: user.id, name: user.name };
      return jsonResponse(body, 200, {
        'set-cookie': buildSessionCookie(token, isSecureRequest(request)),
      });
    },
  },
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
        name: (await users.getName(principal.userId)) ?? `User ${principal.userId}`,
      };
      return jsonResponse(body);
    },
  },
];

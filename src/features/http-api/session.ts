import type { ApiTokenStore } from '../api-tokens/api-token-store.ts';
import { jsonResponse } from './json-response.ts';
import { buildSessionCookie, isSecureRequest } from './session-cookie.ts';

export const WEB_SESSION_LABEL = 'web';

/* Every successful ceremony ends the same way: a fresh session token in the
   cookie and a JSON body describing who is now signed in. */
export const createSessionIssuer =
  (tokens: ApiTokenStore) =>
  async (request: Request, accountId: number, body: unknown, status = 200): Promise<Response> => {
    const { token } = await tokens.create(accountId, WEB_SESSION_LABEL);
    return jsonResponse(body, status, { 'set-cookie': buildSessionCookie(token, isSecureRequest(request)) });
  };

export type SessionIssuer = ReturnType<typeof createSessionIssuer>;

import type { ApiTokenStore } from '../api-tokens/api-token-store.ts';
import { readSessionCookie } from './session-cookie.ts';

export type Principal = {
  readonly userId: number;
  readonly tokenId: string;
  readonly via: 'bearer' | 'cookie';
};

const BEARER_PREFIX = 'Bearer ';

const readBearer = (request: Request): string | undefined => {
  const header = request.headers.get('authorization') ?? '';
  return header.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length).trim() : undefined;
};

/* A bearer header wins over the cookie so the CLI keeps working from a
   browser-adjacent environment; both resolve through the same token table. */
export const createAuthenticator =
  (tokens: ApiTokenStore) =>
  async (request: Request): Promise<Principal | undefined> => {
    const bearer = readBearer(request);
    const via = bearer === undefined ? 'cookie' : 'bearer';
    const token = bearer ?? readSessionCookie(request);
    if (token === undefined) {
      return undefined;
    }
    const resolved = await tokens.resolve(token);
    return resolved === undefined ? undefined : { userId: resolved.userId, tokenId: resolved.id, via };
  };

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/* Browsers attach the session cookie to cross-site form posts; they also
   attach `Origin`, which an attacker's page cannot spoof. Bearer requests
   are not ambient credentials and skip the check. */
export const isCrossSiteMutation = (request: Request, via: 'bearer' | 'cookie'): boolean =>
  via === 'cookie' &&
  !SAFE_METHODS.has(request.method) &&
  request.headers.get('origin') !== new URL(request.url).origin;

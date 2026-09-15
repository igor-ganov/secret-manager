import type { ApiTokenStore } from '../api-tokens/api-token-store.ts';
import type { SharingService } from '../sharing/sharing-service.ts';
import { createTelegramLoginVerifier } from '../telegram-auth/verify-telegram-login.ts';
import type { UserStore } from '../users/user-store.ts';
import { createAuthRoutes } from './auth-routes.ts';
import { createAuthenticator, isCrossSiteMutation } from './authenticate.ts';
import { errorResponse, forbidden, notFound, unauthorized } from './json-response.ts';
import { matchPath } from './match-path.ts';
import type { Route } from './route.ts';
import { createSecretRoutes } from './secret-routes.ts';
import { createSettingsRoutes } from './settings-routes.ts';
import { createTokenRoutes } from './token-routes.ts';

export const API_PATH_PREFIX = '/api/';

export type ApiDependencies = {
  readonly sharing: SharingService;
  readonly tokens: ApiTokenStore;
  readonly users: UserStore;
  readonly botToken: string;
  readonly now: () => number;
};

const CSRF_ERROR = 'Cross-site request rejected.';

/* The numeric part before the colon identifies the bot publicly (Telegram
   login needs it); the rest of the token never leaves the server. */
export const botIdFromToken = (botToken: string): number => Number(botToken.split(':')[0]);

type Match = { readonly route: Route; readonly params: Readonly<Record<string, string>> };

const findMatch = (routes: readonly Route[], method: string, pathname: string): Match | undefined =>
  routes
    .filter((route) => route.method === method)
    .flatMap((route) => {
      const params = matchPath(route.pattern, pathname);
      return params === undefined ? [] : [{ route, params }];
    })[0];

const pathExists = (routes: readonly Route[], pathname: string): boolean =>
  routes.some((route) => matchPath(route.pattern, pathname) !== undefined);

export const createApiRequestHandler = ({
  sharing,
  tokens,
  users,
  botToken,
  now,
}: ApiDependencies) => {
  const authenticate = createAuthenticator(tokens);
  const routes: readonly Route[] = [
    ...createAuthRoutes({
      tokens,
      users,
      verifyLogin: createTelegramLoginVerifier({ botToken, now }),
      botId: botIdFromToken(botToken),
    }),
    ...createTokenRoutes(tokens),
    ...createSecretRoutes(sharing),
    ...createSettingsRoutes(sharing),
  ];

  const dispatch = async (request: Request, { route, params }: Match): Promise<Response> => {
    switch (route.auth) {
      case 'none':
        return isCrossSiteMutation(request, 'cookie')
          ? forbidden(CSRF_ERROR)
          : route.handle({ request, params });
      case 'user': {
        const principal = await authenticate(request);
        if (principal === undefined) {
          return unauthorized();
        }
        if (isCrossSiteMutation(request, principal.via)) {
          return forbidden(CSRF_ERROR);
        }
        return route.handle({ request, params, principal });
      }
    }
  };

  return async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url);
    const match = findMatch(routes, request.method, pathname);
    if (match !== undefined) {
      return dispatch(request, match);
    }
    return pathExists(routes, pathname)
      ? errorResponse(405, 'Method not allowed.')
      : notFound();
  };
};

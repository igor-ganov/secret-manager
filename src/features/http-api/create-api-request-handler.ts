import type { AccountStore } from '../accounts/account-store.ts';
import type { ApiTokenStore } from '../api-tokens/api-token-store.ts';
import type { DeviceLogin } from '../device-login/create-device-login.ts';
import type { LoginRequestStore } from '../device-login/login-request-store.ts';
import type { TelegramLinkStore } from '../device-login/telegram-link-store.ts';
import type { TelegramNotifier } from '../device-login/telegram-notifier.ts';
import type { EnrollmentStore } from '../enrollment/enrollment-store.ts';
import type { ChallengeStore } from '../passkeys/challenge-store.ts';
import type { PasskeyCeremonies } from '../passkeys/passkey-ceremonies.ts';
import type { PasskeyStore } from '../passkeys/passkey-store.ts';
import type { SharingService } from '../sharing/sharing-service.ts';
import { createAuthRoutes } from './auth-routes.ts';
import { createAuthenticator, isCrossSiteMutation } from './authenticate.ts';
import { clientKeyOf, createRateLimiter } from './create-rate-limiter.ts';
import { createDeviceRoutes } from './device-routes.ts';
import { createDevicesRoutes } from './devices-routes.ts';
import { createEnrollmentRoutes } from './enrollment-routes.ts';
import { errorResponse, forbidden, notFound, unauthorized } from './json-response.ts';
import { matchPath } from './match-path.ts';
import { createPasskeyRoutes } from './passkey-routes.ts';
import { createRecoveryRoutes } from './recovery-routes.ts';
import type { Route } from './route.ts';
import { createSecretRoutes } from './secret-routes.ts';
import { readSessionCookie } from './session-cookie.ts';
import { createSessionIssuer } from './session.ts';
import { createSettingsRoutes } from './settings-routes.ts';

export const API_PATH_PREFIX = '/api/';

export type ApiDependencies = {
  readonly sharing: SharingService;
  readonly tokens: ApiTokenStore;
  readonly accounts: AccountStore;
  readonly passkeys: PasskeyStore;
  readonly challenges: ChallengeStore;
  readonly ceremonies: PasskeyCeremonies;
  readonly enrollments: EnrollmentStore;
  readonly loginRequests: LoginRequestStore;
  readonly deviceLogin: DeviceLogin;
  readonly telegramLinks: TelegramLinkStore;
  readonly moveLegacyData: (fromUserId: number, toUserId: number) => Promise<void>;
  readonly notifyTelegram: TelegramNotifier;
  /* Public origin of the site, from configuration (links, QR codes). */
  readonly siteOrigin: string;
  readonly now: () => number;
};

const CSRF_ERROR = 'Cross-site request rejected.';
const RATE_LIMIT = { limit: 30, windowMs: 60 * 1000 } as const;

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

export const createApiRequestHandler = (deps: ApiDependencies) => {
  const { tokens, now } = deps;
  const authenticate = createAuthenticator(tokens);
  const limiter = createRateLimiter({ ...RATE_LIMIT, now });
  const issueSession = createSessionIssuer(tokens);
  const flow = { ...deps, issueSession };
  const routes: readonly Route[] = [
    ...createAuthRoutes(deps),
    ...createPasskeyRoutes(flow),
    ...createEnrollmentRoutes(flow),
    ...createRecoveryRoutes(flow),
    ...createDeviceRoutes(deps),
    ...createDevicesRoutes(deps),
    ...createSecretRoutes(deps.sharing),
    ...createSettingsRoutes(deps.sharing),
  ];

  const dispatch = async (request: Request, { route, params }: Match): Promise<Response> => {
    if (route.limited === true && !limiter.allow(`${route.pattern}:${clientKeyOf(request)}`)) {
      return errorResponse(429, 'Too many attempts, try again in a minute.');
    }
    switch (route.auth) {
      case 'none':
        /* Only a browser carrying the session cookie can be tricked into a
           cross-site call; the CLI and other cookie-less clients pass. */
        return readSessionCookie(request) !== undefined && isCrossSiteMutation(request, 'cookie')
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
    return pathExists(routes, pathname) ? errorResponse(405, 'Method not allowed.') : notFound();
  };
};

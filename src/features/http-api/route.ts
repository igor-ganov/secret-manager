import type { Principal } from './authenticate.ts';
import type { PathParams } from './match-path.ts';

export type PublicRouteContext = {
  readonly request: Request;
  readonly params: PathParams;
};

export type UserRouteContext = PublicRouteContext & {
  readonly principal: Principal;
};

type RouteBase = {
  readonly method: string;
  readonly pattern: string;
  /* Rate-limited per client address: ceremonies, codes, device requests. */
  readonly limited?: boolean;
};

export type Route =
  | (RouteBase & {
      readonly auth: 'none';
      readonly handle: (context: PublicRouteContext) => Promise<Response>;
    })
  | (RouteBase & {
      readonly auth: 'user';
      readonly handle: (context: UserRouteContext) => Promise<Response>;
    });

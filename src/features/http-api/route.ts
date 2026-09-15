import type { Principal } from './authenticate.ts';
import type { PathParams } from './match-path.ts';

export type PublicRouteContext = {
  readonly request: Request;
  readonly params: PathParams;
};

export type UserRouteContext = PublicRouteContext & {
  readonly principal: Principal;
};

export type Route =
  | {
      readonly method: string;
      readonly pattern: string;
      readonly auth: 'none';
      readonly handle: (context: PublicRouteContext) => Promise<Response>;
    }
  | {
      readonly method: string;
      readonly pattern: string;
      readonly auth: 'user';
      readonly handle: (context: UserRouteContext) => Promise<Response>;
    };

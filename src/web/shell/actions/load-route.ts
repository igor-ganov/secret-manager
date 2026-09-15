import { matchResult } from '../../../features/result/match-result.ts';
import type { Route, Session } from '../../state/app-state.ts';
import type { ActionDeps } from '../action-deps.ts';

type Loader = (deps: ActionDeps, code: string) => Promise<void>;

/* A signed-out visitor cannot read a login request yet (401): that is not
   an error to show, the login card handles it. */
const LINK_ERROR: Readonly<Record<Session['kind'], (error: string) => string | undefined>> = {
  'signed-in': (error) => error,
  anonymous: () => undefined,
  loading: () => undefined,
};

const LOADERS: Readonly<Record<Route['kind'], Loader>> = {
  home: async ({ store }) => store.patch({ enrollmentInfo: undefined, linkInfo: undefined }),
  enroll: async ({ api, store }, code) =>
    matchResult(
      await api.enrollmentInfo(code),
      (enrollmentInfo) => store.patch({ enrollmentInfo, error: undefined }),
      (error) => store.patch({ enrollmentInfo: undefined, error }),
    ),
  link: async ({ api, store }, code) =>
    matchResult(
      await api.loginRequestInfo(code),
      (linkInfo) => store.patch({ linkInfo, error: undefined }),
      (error) => store.patch({ linkInfo: undefined, error: LINK_ERROR[store.get().session.kind](error) }),
    ),
};

const codeOf = (route: Route): string => {
  switch (route.kind) {
    case 'home':
      return '';
    case 'enroll':
    case 'link':
      return route.code;
  }
};

export const loadRoute =
  (deps: ActionDeps) =>
  async (route: Route): Promise<void> => {
    deps.store.patch({ route });
    await LOADERS[route.kind](deps, codeOf(route));
  };

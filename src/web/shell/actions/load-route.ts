import { matchResult } from '../../../features/result/match-result.ts';
import type { Route } from '../../state/app-state.ts';
import type { ActionDeps } from '../action-deps.ts';
import { approveLink } from './approve-link.ts';

type Loader = (deps: ActionDeps, code: string) => Promise<void>;

const LOADERS: Readonly<Record<Route['kind'], Loader>> = {
  home: async ({ store }) => store.patch({ enrollmentInfo: undefined, linkInfo: undefined }),
  enroll: async ({ api, store }, code) =>
    matchResult(
      await api.enrollmentInfo(code),
      (enrollmentInfo) => store.patch({ enrollmentInfo, error: undefined }),
      (error) => store.patch({ enrollmentInfo: undefined, error }),
    ),
  /* A device link asks for the passkey at once and approves in one go. */
  link: (deps, code) => approveLink(deps)(code),
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
    deps.store.patch({ route, linkInfo: undefined, error: undefined });
    await LOADERS[route.kind](deps, codeOf(route));
  };

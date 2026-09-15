import { matchResult } from '../../../features/result/match-result.ts';
import type { Route } from '../../state/app-state.ts';
import type { ActionDeps } from '../action-deps.ts';
import { loadRoute } from './load-route.ts';
import { loadWorkspace } from './load-workspace.ts';

/* A rejected /api/me simply means "not signed in". The route is loaded
   afterwards because reading a login request needs the session. */
export const init =
  (deps: ActionDeps) =>
  async (route: Route): Promise<void> => {
    const { api, store } = deps;
    await matchResult(
      await api.me(),
      (user) => loadWorkspace(deps)(user),
      async () => store.patch({ session: { kind: 'anonymous' } }),
    );
    await loadRoute(deps)(route);
  };

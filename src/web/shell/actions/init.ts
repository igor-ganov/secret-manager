import { matchResult } from '../../../features/result/match-result.ts';
import type { ActionDeps } from '../action-deps.ts';
import { loadWorkspace } from './load-workspace.ts';

/* A rejected /api/me simply means "not signed in"; only a missing bot id
   (the server itself unreachable) is surfaced as an error. */
export const init = (deps: ActionDeps) => async (): Promise<void> => {
  const { api, store } = deps;
  const config = await api.authConfig();
  await matchResult(
    config,
    async ({ botId }) =>
      matchResult(
        await api.me(),
        (user) => loadWorkspace(deps)(user, botId),
        async () => store.patch({ session: { kind: 'anonymous', botId } }),
      ),
    async (error) => store.patch({ error }),
  );
};

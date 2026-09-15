import { matchResult } from '../../../features/result/match-result.ts';
import type { Session } from '../../state/app-state.ts';
import type { ActionDeps } from '../action-deps.ts';
import { loadWorkspace } from './load-workspace.ts';

const botIdOf = (session: Session): number | undefined => {
  switch (session.kind) {
    case 'loading':
      return undefined;
    case 'anonymous':
    case 'signed-in':
      return session.botId;
  }
};

/* Runs after `init`, with the payload Telegram put in the url fragment. */
export const completeLogin =
  (deps: ActionDeps) =>
  async (payload: unknown): Promise<void> => {
    const { api, store } = deps;
    const botId = botIdOf(store.get().session);
    switch (payload) {
      case undefined:
        return;
      default:
        return matchResult(
          await api.loginTelegram(payload),
          (user) => loadWorkspace(deps)(user, botId ?? 0),
          async (error) => store.patch({ error }),
        );
    }
  };

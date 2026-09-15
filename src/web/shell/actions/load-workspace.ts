import type { MeResponse } from '../../../features/http-api/api-types.ts';
import { valueOr } from '../../../features/result/value-or.ts';
import { initialState } from '../../state/initial-state.ts';
import type { ActionDeps } from '../action-deps.ts';

/* Everything the workspace shows is fetched before the signed-in view
   appears, in one patch, so typing is never wiped by a late response. */
export const loadWorkspace =
  ({ api, store }: ActionDeps) =>
  async (user: MeResponse, botId: number): Promise<void> => {
    const [keys, settings, tokens] = await Promise.all([api.keys(), api.settings(), api.tokens()]);
    store.patch({
      session: { kind: 'signed-in', user, botId },
      keys: valueOr(keys, { keys: [] }).keys,
      settings: valueOr(settings, initialState.settings),
      tokens: valueOr(tokens, { tokens: [] }).tokens,
      rowModes: {},
      error: undefined,
    });
  };

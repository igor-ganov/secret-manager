import { matchResult } from '../../../features/result/match-result.ts';
import type { ActionDeps } from '../action-deps.ts';
import { refreshTokens } from './refresh-tokens.ts';

export const revokeToken =
  (deps: ActionDeps) =>
  async (id: string): Promise<void> => {
    const { api, store } = deps;
    const onOk = async (): Promise<void> =>
      store.patch({ tokens: await refreshTokens(deps)(), error: undefined });
    await matchResult(await api.revokeToken(id), onOk, async (error) => store.patch({ error }));
  };

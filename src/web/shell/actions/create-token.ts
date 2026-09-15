import type { CreatedTokenResponse } from '../../../features/http-api/api-types.ts';
import { matchResult } from '../../../features/result/match-result.ts';
import type { ActionDeps } from '../action-deps.ts';
import { refreshTokens } from './refresh-tokens.ts';

export const createToken =
  (deps: ActionDeps) =>
  async (label: string): Promise<void> => {
    const { api, store } = deps;
    const onOk = async (token: CreatedTokenResponse): Promise<void> =>
      store.patch({ notice: { kind: 'token', token }, tokens: await refreshTokens(deps)(), error: undefined });
    await matchResult(await api.createToken(label), onOk, async (error) => store.patch({ error }));
  };

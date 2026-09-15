import type { TokenResponse } from '../../../features/http-api/api-types.ts';
import { valueOr } from '../../../features/result/value-or.ts';
import type { ActionDeps } from '../action-deps.ts';

export const refreshTokens =
  ({ api, store }: ActionDeps) =>
  async (): Promise<readonly TokenResponse[]> =>
    valueOr(await api.tokens(), { tokens: store.get().tokens }).tokens;

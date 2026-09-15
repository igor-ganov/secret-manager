import { valueOr } from '../../../features/result/value-or.ts';
import type { ActionDeps } from '../action-deps.ts';

export const refreshKeys =
  ({ api, store }: ActionDeps) =>
  async (): Promise<readonly string[]> =>
    valueOr(await api.keys(), { keys: store.get().keys }).keys;

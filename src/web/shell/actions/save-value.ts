import { matchResult } from '../../../features/result/match-result.ts';
import { withoutKey } from '../../state/without-key.ts';
import type { ActionDeps } from '../action-deps.ts';

export const saveValue =
  ({ api, store }: ActionDeps) =>
  async (key: string, value: string): Promise<void> =>
    matchResult(
      await api.save(key, value),
      () =>
        store.patch({
          rowModes: withoutKey(store.get().rowModes, key),
          notice: { kind: 'info', text: `Value of “${key}” has been updated.` },
          error: undefined,
        }),
      (error) => store.patch({ error }),
    );

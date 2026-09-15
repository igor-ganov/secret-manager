import { matchResult } from '../../../features/result/match-result.ts';
import { withoutKey } from '../../state/without-key.ts';
import type { ActionDeps } from '../action-deps.ts';
import { refreshKeys } from './refresh-keys.ts';

export const confirmDelete =
  (deps: ActionDeps) =>
  async (key: string): Promise<void> => {
    const { api, store } = deps;
    const onOk = async (): Promise<void> =>
      store.patch({
        keys: await refreshKeys(deps)(),
        rowModes: withoutKey(store.get().rowModes, key),
        notice: { kind: 'info', text: `“${key}” has been deleted.` },
        error: undefined,
      });
    await matchResult(await api.remove(key), onOk, async (error) => store.patch({ error }));
  };

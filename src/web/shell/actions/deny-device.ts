import { matchResult } from '../../../features/result/match-result.ts';
import type { ActionDeps } from '../action-deps.ts';

const DENIED = 'Device request denied.';

export const denyDevice =
  ({ api, store, clearHash }: ActionDeps) =>
  async (code: string): Promise<void> =>
    matchResult(
      await api.denyDevice(code),
      () => {
        clearHash();
        store.patch({ route: { kind: 'home' }, linkInfo: undefined, notice: { kind: 'info', text: DENIED }, error: undefined });
      },
      (error) => store.patch({ error }),
    );

import { matchResult } from '../../../features/result/match-result.ts';
import type { ActionDeps } from '../action-deps.ts';
import { refreshDevices } from './refresh-devices.ts';

export const unlinkTelegram =
  (deps: ActionDeps) =>
  async (): Promise<void> => {
    const { api, store } = deps;
    const onOk = async (): Promise<void> =>
      store.patch({ devices: await refreshDevices(deps)(), notice: { kind: 'info', text: 'Telegram chat unlinked.' }, error: undefined });
    await matchResult(await api.unlinkTelegram(), onOk, async (error) => store.patch({ error }));
  };

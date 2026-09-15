import { matchResult } from '../../../features/result/match-result.ts';
import type { ActionDeps } from '../action-deps.ts';
import { refreshDevices } from './refresh-devices.ts';

export const removePasskey =
  (deps: ActionDeps) =>
  async (id: string): Promise<void> => {
    const { api, store } = deps;
    const onOk = async (): Promise<void> => store.patch({ devices: await refreshDevices(deps)(), error: undefined });
    await matchResult(await api.removePasskey(id), onOk, async (error) => store.patch({ error }));
  };

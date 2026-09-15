import { matchResult } from '../../../features/result/match-result.ts';
import type { ActionDeps } from '../action-deps.ts';
import { refreshDevices } from './refresh-devices.ts';

const APPROVED = 'Device approved. It can use your account now.';

export const approveDevice =
  (deps: ActionDeps) =>
  async (code: string): Promise<void> => {
    const { api, store, clearHash } = deps;
    const onOk = async (): Promise<void> => {
      clearHash();
      store.patch({
        route: { kind: 'home' },
        linkInfo: undefined,
        devices: await refreshDevices(deps)(),
        notice: { kind: 'info', text: APPROVED },
        error: undefined,
      });
    };
    await matchResult(await api.approveDevice(code), onOk, async (error) => store.patch({ error }));
  };

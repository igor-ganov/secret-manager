import { matchResult } from '../../../features/result/match-result.ts';
import { createCredential } from '../../auth/create-credential.ts';
import { runCeremony } from '../../auth/run-ceremony.ts';
import type { ActionDeps } from '../action-deps.ts';
import { refreshDevices } from './refresh-devices.ts';

export const addPasskeyHere =
  (deps: ActionDeps) =>
  async (label: string): Promise<void> => {
    const { api, store } = deps;
    const onOk = async (): Promise<void> =>
      store.patch({
        devices: await refreshDevices(deps)(),
        notice: { kind: 'info', text: `Passkey “${label}” added.` },
        error: undefined,
      });
    await matchResult(
      await runCeremony(api.addOptions, createCredential, (response) => api.addVerify(response, label)),
      onOk,
      async (error) => store.patch({ error }),
    );
  };

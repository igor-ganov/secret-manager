import { matchResult } from '../../../features/result/match-result.ts';
import { createCredential } from '../../auth/create-credential.ts';
import { runCeremony } from '../../auth/run-ceremony.ts';
import type { ActionDeps } from '../action-deps.ts';
import { finishSignIn } from './finish-sign-in.ts';

export const signUp =
  (deps: ActionDeps) =>
  async (name: string): Promise<void> => {
    const { api, store, deviceName } = deps;
    await matchResult(
      await runCeremony(
        () => api.registerOptions(name),
        createCredential,
        (response) => api.registerVerify(response, deviceName),
      ),
      finishSignIn(deps),
      async (error) => store.patch({ error }),
    );
  };

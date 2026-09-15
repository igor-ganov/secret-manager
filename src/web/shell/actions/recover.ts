import { matchResult } from '../../../features/result/match-result.ts';
import { createCredential } from '../../auth/create-credential.ts';
import { runCeremony } from '../../auth/run-ceremony.ts';
import type { ActionDeps } from '../action-deps.ts';
import { finishSignIn } from './finish-sign-in.ts';

export const recover =
  (deps: ActionDeps) =>
  async (code: string): Promise<void> => {
    const { api, store } = deps;
    await matchResult(
      await runCeremony(
        () => api.recoveryOptions(code),
        createCredential,
        (response) => api.recoveryVerify(code, response),
      ),
      finishSignIn(deps),
      async (error) => store.patch({ error }),
    );
  };

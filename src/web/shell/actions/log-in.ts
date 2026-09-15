import { matchResult } from '../../../features/result/match-result.ts';
import { getCredential } from '../../auth/get-credential.ts';
import { runCeremony } from '../../auth/run-ceremony.ts';
import type { ActionDeps } from '../action-deps.ts';
import { finishSignIn } from './finish-sign-in.ts';

export const logIn = (deps: ActionDeps) => async (): Promise<void> => {
  const { api, store } = deps;
  await matchResult(
    await runCeremony(api.loginOptions, getCredential, api.loginVerify),
    finishSignIn(deps),
    async (error) => store.patch({ error }),
  );
};

import { matchResult } from '../../../features/result/match-result.ts';
import { getCredential } from '../../auth/get-credential.ts';
import { runCeremony } from '../../auth/run-ceremony.ts';
import type { ActionDeps } from '../action-deps.ts';
import { finishSignIn } from './finish-sign-in.ts';

/* One entry point. The browser looks for a passkey of this site; when none
   is used (there is none, or the prompt was dismissed) the card offers to
   create an account instead — a confirmation, so a dismissed login can
   never silently become a second account. */
export const continueWithPasskey = (deps: ActionDeps) => async (): Promise<void> => {
  const { api, store } = deps;
  await matchResult(
    await runCeremony(api.loginOptions, getCredential, api.loginVerify),
    finishSignIn(deps),
    async () => store.patch({ loginAttempted: true, error: undefined }),
  );
};

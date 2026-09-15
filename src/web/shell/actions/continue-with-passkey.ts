import { matchResult } from '../../../features/result/match-result.ts';
import { getCredential } from '../../auth/get-credential.ts';
import { runCeremony } from '../../auth/run-ceremony.ts';
import type { ActionDeps } from '../action-deps.ts';
import { finishSignIn } from './finish-sign-in.ts';
import { signUp } from './sign-up.ts';

/* One action. The browser looks for a passkey of this site and signs in;
   when none is used, an account is created right away — the passkey
   creation dialog the device shows is the confirmation. */
export const continueWithPasskey = (deps: ActionDeps) => async (): Promise<void> => {
  const { api } = deps;
  await matchResult(
    await runCeremony(api.loginOptions, getCredential, api.loginVerify),
    finishSignIn(deps),
    () => signUp(deps)(),
  );
};

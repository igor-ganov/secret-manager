import type { SignedInResponse } from '../../../features/http-api/api-types.ts';
import { matchResult } from '../../../features/result/match-result.ts';
import { createCredential } from '../../auth/create-credential.ts';
import { runCeremony } from '../../auth/run-ceremony.ts';
import type { ActionDeps } from '../action-deps.ts';
import { finishSignIn } from './finish-sign-in.ts';

/* The enrollment code is consumed by the verify call, so the fragment is
   cleared before the workspace appears. */
export const enrollHere =
  (deps: ActionDeps) =>
  async (code: string, label: string): Promise<void> => {
    const { api, store, clearHash } = deps;
    const onOk = async (signedIn: SignedInResponse): Promise<void> => {
      clearHash();
      store.patch({ route: { kind: 'home' }, enrollmentInfo: undefined });
      await finishSignIn(deps)(signedIn);
      store.patch({ notice: { kind: 'info', text: 'This device now has a passkey for your account.' } });
    };
    await matchResult(
      await runCeremony(
        () => api.enrollOptions(code),
        createCredential,
        (response) => api.enrollVerify(code, response, label),
      ),
      onOk,
      async (error) => store.patch({ error }),
    );
  };

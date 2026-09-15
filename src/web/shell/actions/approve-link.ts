import type { LoginRequestInfoResponse } from '../../../features/http-api/api-types.ts';
import { matchResult } from '../../../features/result/match-result.ts';
import { getCredential } from '../../auth/get-credential.ts';
import { runCeremony } from '../../auth/run-ceremony.ts';
import type { ActionDeps } from '../action-deps.ts';
import { loadWorkspace } from './load-workspace.ts';

/* Right after approval the browser goes back to the device; the page keeps
   the code on screen for the case where that navigation fails, and a later
   visit shows the code only — never a second redirect. */
const RETURN: Readonly<Record<`${boolean}`, (deps: ActionDeps, info: LoginRequestInfoResponse) => void>> = {
  true: ({ navigate }, info) => navigate(`${info.callback}?grant=${encodeURIComponent(info.grant)}`),
  false: () => undefined,
};

const showRequest = async (deps: ActionDeps, code: string, returnToDevice: boolean): Promise<void> =>
  matchResult(
    await deps.api.loginRequestInfo(code),
    (linkInfo) => {
      deps.store.patch({ linkInfo, error: undefined });
      RETURN[`${returnToDevice && linkInfo.status === 'approved' && linkInfo.callback !== ''}`](deps, linkInfo);
    },
    (error) => deps.store.patch({ linkInfo: undefined, error }),
  );

/* A pending request is approved right after the passkey ceremony; one that
   was already answered just shows its outcome (the fallback code again). */
const approve = async (deps: ActionDeps, code: string): Promise<void> =>
  matchResult(
    await deps.api.approveDevice(code),
    () => showRequest(deps, code, true),
    () => showRequest(deps, code, false),
  );

/* The link page: passkey first (approving re-authenticates, whatever the
   session state), then approval, then back to the device. */
export const approveLink =
  (deps: ActionDeps) =>
  async (code: string): Promise<void> => {
    const { api, store } = deps;
    await matchResult(
      await runCeremony(api.loginOptions, getCredential, api.loginVerify),
      async (user) => {
        await loadWorkspace(deps)(user);
        await approve(deps, code);
      },
      async (error) => store.patch({ error }),
    );
  };

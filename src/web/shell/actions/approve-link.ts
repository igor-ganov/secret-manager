import type { LoginRequestInfoResponse, MeResponse } from '../../../features/http-api/api-types.ts';
import { matchResult } from '../../../features/result/match-result.ts';
import type { Result } from '../../../features/result/result.ts';
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

/* A pending request is approved at once; one that was already answered just
   shows its outcome (the fallback code again). */
const approve = async (deps: ActionDeps, code: string): Promise<void> =>
  matchResult(
    await deps.api.approveDevice(code),
    () => showRequest(deps, code, true),
    () => showRequest(deps, code, false),
  );

/* An existing session is enough; the passkey is asked only without one. */
const signIn = async ({ api }: ActionDeps): Promise<Result<MeResponse>> =>
  matchResult(
    await api.me(),
    async (user) => ({ ok: true, value: user }),
    () => runCeremony(api.loginOptions, getCredential, api.loginVerify),
  );

export const approveLink =
  (deps: ActionDeps) =>
  async (code: string): Promise<void> => {
    const { store } = deps;
    await matchResult(
      await signIn(deps),
      async (user) => {
        await loadWorkspace(deps)(user);
        await approve(deps, code);
      },
      async (error) => store.patch({ error }),
    );
  };

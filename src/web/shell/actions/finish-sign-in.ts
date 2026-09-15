import type { SignedInResponse } from '../../../features/http-api/api-types.ts';
import type { Notice } from '../../state/app-state.ts';
import type { ActionDeps } from '../action-deps.ts';
import { loadRoute } from './load-route.ts';
import { loadWorkspace } from './load-workspace.ts';

const NOTICES: Readonly<Record<`${boolean}`, (signedIn: SignedInResponse) => Notice>> = {
  true: (signedIn) => ({ kind: 'recovery', code: signedIn.recoveryCode ?? '' }),
  false: () => ({ kind: 'idle' }),
};

/* Common tail of signup, login, enrollment and recovery: load the
   workspace, surface a fresh recovery code when one was issued, and revisit
   the route (a pending device approval may now be readable). */
export const finishSignIn =
  (deps: ActionDeps) =>
  async (signedIn: SignedInResponse): Promise<void> => {
    await loadWorkspace(deps)(signedIn);
    deps.store.patch({ notice: NOTICES[`${signedIn.recoveryCode !== undefined}`](signedIn) });
    await loadRoute(deps)(deps.store.get().route);
  };

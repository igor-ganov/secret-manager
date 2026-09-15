import type { Actions } from '../view/actions.ts';
import type { ActionDeps } from './action-deps.ts';
import { completeLogin } from './actions/complete-login.ts';
import { confirmDelete } from './actions/confirm-delete.ts';
import { copy } from './actions/copy.ts';
import { createToken } from './actions/create-token.ts';
import { init } from './actions/init.ts';
import { linkFor } from './actions/link-for.ts';
import { logout } from './actions/logout.ts';
import { revokeToken } from './actions/revoke-token.ts';
import { saveValue } from './actions/save-value.ts';
import { setRowMode } from './actions/set-row-mode.ts';
import { setTtl } from './actions/set-ttl.ts';
import { share } from './actions/share.ts';

export type ShellActions = Actions & {
  readonly init: () => Promise<void>;
  readonly completeLogin: (payload: unknown) => Promise<void>;
};

export const createActions = (deps: ActionDeps): ShellActions => ({
  init: init(deps),
  completeLogin: completeLogin(deps),
  logout: logout(deps),
  share: share(deps),
  linkFor: linkFor(deps),
  setRowMode: setRowMode(deps),
  saveValue: saveValue(deps),
  confirmDelete: confirmDelete(deps),
  setTtl: setTtl(deps),
  createToken: createToken(deps),
  revokeToken: revokeToken(deps),
  copy: copy(deps),
});

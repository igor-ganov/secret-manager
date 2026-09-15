import type { ActionDeps } from './action-deps.ts';
import { addPasskeyHere } from './actions/add-passkey-here.ts';
import { approveLink } from './actions/approve-link.ts';
import { confirmDelete } from './actions/confirm-delete.ts';
import { continueWithPasskey } from './actions/continue-with-passkey.ts';
import { copy } from './actions/copy.ts';
import { createEnrollment } from './actions/create-enrollment.ts';
import { enrollHere } from './actions/enroll-here.ts';
import { init } from './actions/init.ts';
import { linkFor } from './actions/link-for.ts';
import { loadRoute } from './actions/load-route.ts';
import { logout } from './actions/logout.ts';
import { recover } from './actions/recover.ts';
import { removePasskey } from './actions/remove-passkey.ts';
import { revokeToken } from './actions/revoke-token.ts';
import { saveValue } from './actions/save-value.ts';
import { setRowMode } from './actions/set-row-mode.ts';
import { setTtl } from './actions/set-ttl.ts';
import { share } from './actions/share.ts';
import { unlinkTelegram } from './actions/unlink-telegram.ts';
import type { ShellActions } from './shell-actions.ts';

export const createActions = (deps: ActionDeps): ShellActions => ({
  init: init(deps),
  loadRoute: loadRoute(deps),
  continueWithPasskey: continueWithPasskey(deps),
  recover: recover(deps),
  enrollHere: enrollHere(deps),
  approveLink: approveLink(deps),
  addPasskeyHere: addPasskeyHere(deps),
  removePasskey: removePasskey(deps),
  createEnrollment: createEnrollment(deps),
  unlinkTelegram: unlinkTelegram(deps),
  revokeToken: revokeToken(deps),
  logout: logout(deps),
  share: share(deps),
  linkFor: linkFor(deps),
  setRowMode: setRowMode(deps),
  saveValue: saveValue(deps),
  confirmDelete: confirmDelete(deps),
  setTtl: setTtl(deps),
  copy: copy(deps),
});

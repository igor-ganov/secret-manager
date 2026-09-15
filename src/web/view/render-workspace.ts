import type { MeResponse } from '../../features/http-api/api-types.ts';
import type { AppState } from '../state/app-state.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { renderDevices } from './render-devices.ts';
import { renderError } from './render-error.ts';
import { renderKeys } from './render-keys.ts';
import { renderNotice } from './render-notice.ts';
import { renderSettings } from './render-settings.ts';
import { renderShareForm } from './render-share-form.ts';

export const renderWorkspace = (
  h: H,
  actions: Actions,
  state: AppState,
  user: MeResponse,
  deviceName: string,
): readonly Node[] => [
  h(
    'header',
    {},
    h('h1', {}, 'Secret manager'),
    h(
      'div',
      { attrs: { class: 'identity' } },
      h('span', {}, user.name),
      h('button', { attrs: { type: 'button', class: 'secondary small' }, on: { click: () => void actions.logout() } }, 'Log out'),
    ),
  ),
  ...renderError(h, state.error),
  renderNotice(h, actions, state.notice),
  h('p', { attrs: { class: 'toast', 'aria-live': 'polite' } }, state.toast),
  renderShareForm(h, actions),
  renderKeys(h, actions, state.keys, state.rowModes),
  renderSettings(h, actions, state.settings),
  renderDevices(h, actions, state.devices, deviceName),
];

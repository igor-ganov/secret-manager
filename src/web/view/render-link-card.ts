import type { LoginRequestInfoResponse } from '../../features/http-api/api-types.ts';
import type { Route } from '../state/app-state.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';

const GONE = 'This login request has expired or was already answered.';

const KIND_TEXT: Readonly<Record<LoginRequestInfoResponse['kind'], string>> = {
  cli: 'The console utility',
  telegram: 'A Telegram chat',
};

const details = (h: H, actions: Actions, code: string, info: LoginRequestInfoResponse | undefined): readonly Node[] => {
  switch (info) {
    case undefined:
      return [h('p', {}, GONE)];
    default:
      return [
        h('p', {}, `${KIND_TEXT[info.kind]} “${info.label}” asks to use your account.`),
        h(
          'div',
          { attrs: { class: 'actions' } },
          h('button', { attrs: { type: 'button', 'data-autofocus': '' }, on: { click: () => void actions.approveDevice(code) } }, 'Approve'),
          h('button', { attrs: { type: 'button', class: 'danger' }, on: { click: () => void actions.denyDevice(code) } }, 'Deny'),
        ),
      ];
  }
};

const card = (h: H, actions: Actions, code: string, info: LoginRequestInfoResponse | undefined): readonly Node[] => [
  h(
    'section',
    { attrs: { 'aria-labelledby': 'link-heading', class: 'highlight' } },
    h('h2', { attrs: { id: 'link-heading' } }, 'Device asking for access'),
    ...details(h, actions, code, info),
  ),
];

/* Shown at the top of the workspace only while the fragment carries a code. */
export const renderLinkCard = (
  h: H,
  actions: Actions,
  route: Route,
  info: LoginRequestInfoResponse | undefined,
): readonly Node[] => {
  switch (route.kind) {
    case 'link':
      return card(h, actions, route.code, info);
    case 'home':
    case 'enroll':
      return [];
  }
};

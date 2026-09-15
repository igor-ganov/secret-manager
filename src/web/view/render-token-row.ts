import type { TokenResponse } from '../../features/http-api/api-types.ts';
import type { Actions } from './actions.ts';
import { formatDate } from './format-date.ts';
import type { H } from './h.ts';

type Trailing = (h: H, actions: Actions, token: TokenResponse) => HTMLElement;

const TRAILING: Readonly<Record<`${boolean}`, Trailing>> = {
  true: (h) => h('span', { attrs: { class: 'muted' } }, 'current session'),
  false: (h, actions, token) =>
    h(
      'button',
      {
        attrs: { type: 'button', class: 'small danger', 'aria-label': `Revoke ${token.label}` },
        on: { click: () => void actions.revokeToken(token.id) },
      },
      'Revoke',
    ),
};

export const renderTokenRow = (h: H, actions: Actions, token: TokenResponse): HTMLElement =>
  h(
    'li',
    {},
    h('span', {}, `${token.label} `, h('span', { attrs: { class: 'muted' } }, `· ${formatDate(token.createdAt)}`)),
    TRAILING[`${token.current}`](h, actions, token),
  );

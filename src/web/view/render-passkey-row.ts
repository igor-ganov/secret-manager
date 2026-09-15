import type { PasskeyResponse } from '../../features/http-api/api-types.ts';
import type { Actions } from './actions.ts';
import { formatDate } from './format-date.ts';
import type { H } from './h.ts';

const SYNCED: Readonly<Record<`${boolean}`, string>> = { true: ' · synced', false: '' };

type Trailing = (h: H, actions: Actions, passkey: PasskeyResponse) => readonly Node[];

/* The last passkey has no Remove button: the server refuses it anyway. */
const TRAILING: Readonly<Record<`${boolean}`, Trailing>> = {
  true: () => [],
  false: (h, actions, passkey) => [
    h(
      'button',
      {
        attrs: { type: 'button', class: 'small danger', 'aria-label': `Remove passkey ${passkey.label}` },
        on: { click: () => void actions.removePasskey(passkey.id) },
      },
      'Remove',
    ),
  ],
};

export const renderPasskeyRow = (h: H, actions: Actions, passkey: PasskeyResponse, isLast: boolean): HTMLElement =>
  h(
    'li',
    {},
    h(
      'span',
      {},
      `${passkey.label} `,
      h('span', { attrs: { class: 'muted' } }, `· ${formatDate(passkey.createdAt)}${SYNCED[`${passkey.backedUp}`]}`),
    ),
    ...TRAILING[`${isLast}`](h, actions, passkey),
  );

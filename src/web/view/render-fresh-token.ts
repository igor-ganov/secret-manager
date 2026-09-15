import type { CreatedTokenResponse } from '../../features/http-api/api-types.ts';
import type { Actions } from './actions.ts';
import { copyButton } from './copy-button.ts';
import type { H } from './h.ts';

export const renderFreshToken = (
  h: H,
  actions: Actions,
  token: CreatedTokenResponse,
): readonly Node[] => [
  h('p', {}, `Token “${token.label}” created. Copy it now — it will not be shown again.`),
  h('pre', {}, token.token),
  h('p', { attrs: { class: 'muted' } }, 'In the console utility run: secret login'),
  h('div', { attrs: { class: 'actions' } }, copyButton(h, actions, 'Copy token', token.token)),
];

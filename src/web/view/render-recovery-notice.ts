import type { Actions } from './actions.ts';
import { copyButton } from './copy-button.ts';
import type { H } from './h.ts';

export const renderRecoveryNotice = (h: H, actions: Actions, code: string): readonly Node[] => [
  h('p', {}, 'Your recovery code. Store it somewhere safe — it is shown only once and is the only way back in if every device is lost.'),
  h('pre', {}, code),
  h('div', { attrs: { class: 'actions' } }, copyButton(h, actions, 'Copy recovery code', code)),
];

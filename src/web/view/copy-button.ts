import type { Actions } from './actions.ts';
import type { H } from './h.ts';

export const copyButton = (h: H, actions: Actions, label: string, text: string): HTMLElement =>
  h(
    'button',
    { attrs: { type: 'button', class: 'secondary small' }, on: { click: () => void actions.copy(text) } },
    label,
  );

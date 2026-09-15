import type { RowMode } from '../state/app-state.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { renderRowActions } from './render-row-actions.ts';

const EMPTY_TEXT = 'You have no saved keys yet.';

const row = (h: H, actions: Actions, key: string, mode: RowMode): HTMLElement =>
  h('li', {}, h('span', { attrs: { class: 'key' } }, key), ...renderRowActions(h, actions, key, mode));

const list = (
  h: H,
  actions: Actions,
  keys: readonly string[],
  rowModes: Readonly<Record<string, RowMode>>,
): HTMLElement => {
  switch (keys.length) {
    case 0:
      return h('p', { attrs: { class: 'muted' } }, EMPTY_TEXT);
    default:
      return h('ul', {}, ...keys.map((key) => row(h, actions, key, rowModes[key] ?? 'idle')));
  }
};

export const renderKeys = (
  h: H,
  actions: Actions,
  keys: readonly string[],
  rowModes: Readonly<Record<string, RowMode>>,
): HTMLElement =>
  h(
    'section',
    { attrs: { 'aria-labelledby': 'keys-heading' } },
    h('h2', { attrs: { id: 'keys-heading' } }, 'Saved keys'),
    list(h, actions, keys, rowModes),
  );

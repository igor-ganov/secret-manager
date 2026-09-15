import type { RowMode } from '../state/app-state.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { onSubmit } from './on-submit.ts';
import { readFormField } from './read-form-field.ts';

type RowRenderer = (h: H, actions: Actions, key: string) => readonly Node[];

const button = (h: H, label: string, extra: Readonly<Record<string, string>>, click: () => void) =>
  h('button', { attrs: { type: 'button', class: 'small', ...extra }, on: { click } }, label);

const idle: RowRenderer = (h, actions, key) => [
  h(
    'div',
    { attrs: { class: 'actions' } },
    button(h, 'Link', { 'aria-label': `Link for ${key}` }, () => void actions.linkFor(key)),
    button(h, 'Set', { 'aria-label': `Set ${key}`, class: 'small secondary' }, () => actions.setRowMode(key, 'setting')),
    button(h, 'Delete', { 'aria-label': `Delete ${key}`, class: 'small danger' }, () => actions.setRowMode(key, 'deleting')),
  ),
];

const setting: RowRenderer = (h, actions, key) => [
  h(
    'form',
    { attrs: { class: 'full' }, on: { submit: onSubmit((event) => void actions.saveValue(key, readFormField(event, 'value'))) } },
    h('label', { attrs: { for: `set-${key}` } }, `New value for ${key}`),
    h('textarea', { attrs: { id: `set-${key}`, name: 'value', required: '', autocomplete: 'off', 'data-autofocus': '' } }),
    h(
      'div',
      { attrs: { class: 'actions' } },
      h('button', { attrs: { type: 'submit', class: 'small' } }, 'Save'),
      button(h, 'Cancel', { class: 'small secondary' }, () => actions.setRowMode(key, 'idle')),
    ),
  ),
];

const deleting: RowRenderer = (h, actions, key) => [
  h(
    'div',
    { attrs: { class: 'actions full' } },
    h('span', {}, `Delete “${key}”? This cannot be undone.`),
    button(h, 'Yes, delete', { class: 'small danger', 'data-autofocus': '' }, () => void actions.confirmDelete(key)),
    button(h, 'Cancel', { class: 'small secondary' }, () => actions.setRowMode(key, 'idle')),
  ),
];

const BY_MODE: Readonly<Record<RowMode, RowRenderer>> = { idle, setting, deleting };

export const renderRowActions = (h: H, actions: Actions, key: string, mode: RowMode): readonly Node[] =>
  BY_MODE[mode](h, actions, key);

import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { onSubmit } from './on-submit.ts';
import { readFormField } from './read-form-field.ts';

/* Collapsed by default: recovery is the exception, not a third way in. */
export const renderRecoveryForm = (h: H, actions: Actions): HTMLElement =>
  h(
    'details',
    { attrs: { class: 'card' } },
    h('summary', {}, 'Lost every device?'),
    h('p', { attrs: { class: 'muted' } }, 'Enter the recovery code shown when the account was created; a passkey is then created on this device and a new code is issued.'),
    h(
      'form',
      { on: { submit: onSubmit((event) => void actions.recover(readFormField(event, 'code').trim())) } },
      h('label', { attrs: { for: 'recovery-code' } }, 'Recovery code'),
      h('input', { attrs: { id: 'recovery-code', name: 'code', type: 'text', required: '', autocomplete: 'off' } }),
      h('button', { attrs: { type: 'submit', class: 'secondary' } }, 'Recover with code'),
    ),
  );

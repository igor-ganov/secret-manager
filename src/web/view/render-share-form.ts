import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { onSubmit } from './on-submit.ts';
import { readFormField } from './read-form-field.ts';

export const renderShareForm = (h: H, actions: Actions): HTMLElement =>
  h(
    'section',
    { attrs: { 'aria-labelledby': 'share-heading' } },
    h('h2', { attrs: { id: 'share-heading' } }, 'Share a secret'),
    h(
      'form',
      {
        on: {
          submit: onSubmit((event) =>
            void actions.share(readFormField(event, 'key').trim(), readFormField(event, 'value')),
          ),
        },
      },
      h('label', { attrs: { for: 'share-key' } }, 'Key (optional)'),
      h('input', {
        attrs: { id: 'share-key', name: 'key', type: 'text', autocomplete: 'off', spellcheck: 'false' },
      }),
      h('label', { attrs: { for: 'share-value' } }, 'Value'),
      h('textarea', {
        attrs: { id: 'share-value', name: 'value', required: '', autocomplete: 'off', spellcheck: 'false' },
      }),
      h('p', { attrs: { class: 'muted' } }, 'With a key the pair is saved to your account; without one only the link is created.'),
      h('button', { attrs: { type: 'submit' } }, 'Get one-time link'),
    ),
  );

import { TTL_PRESETS_MINUTES } from '../../features/settings/ttl-presets.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { onSubmit } from './on-submit.ts';
import { readFormField } from './read-form-field.ts';
import { renderTtlChoices } from './render-ttl-choices.ts';

const LEAD = 'Paste a secret, get a link that opens once. Nothing is stored and no account is needed.';

/* The front page (web-quick-start AC-1.1): the draft comes from the state so a
   failed drop re-renders with the text still in place. */
export const renderQuickStart = (h: H, actions: Actions, draft: string, ttlMinutes: number): HTMLElement =>
  h(
    'section',
    { attrs: { 'aria-labelledby': 'quick-heading' } },
    h('h2', { attrs: { id: 'quick-heading' } }, 'Quick start'),
    h('p', { attrs: { class: 'muted' } }, LEAD),
    h(
      'form',
      {
        on: {
          submit: onSubmit((event) =>
            void actions.drop(readFormField(event, 'secret'), Number(readFormField(event, 'ttl'))),
          ),
        },
      },
      h('label', { attrs: { for: 'quick-secret' } }, 'Secret'),
      h(
        'textarea',
        { attrs: { id: 'quick-secret', name: 'secret', required: '', autocomplete: 'off', spellcheck: 'false', 'data-autofocus': '' } },
        draft,
      ),
      renderTtlChoices(h, { presets: TTL_PRESETS_MINUTES, current: ttlMinutes }),
      h('button', { attrs: { type: 'submit' } }, 'Get one-time link'),
    ),
  );

import type { TokenResponse } from '../../features/http-api/api-types.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { onSubmit } from './on-submit.ts';
import { readFormField } from './read-form-field.ts';
import { renderTokenRow } from './render-token-row.ts';

export const renderTokens = (h: H, actions: Actions, tokens: readonly TokenResponse[]): HTMLElement =>
  h(
    'section',
    { attrs: { 'aria-labelledby': 'tokens-heading' } },
    h('h2', { attrs: { id: 'tokens-heading' } }, 'CLI tokens'),
    h('p', { attrs: { class: 'muted' } }, 'Tokens let the console utility act on your behalf. Revoke any you no longer use.'),
    h('ul', {}, ...tokens.map((token) => renderTokenRow(h, actions, token))),
    h(
      'form',
      { on: { submit: onSubmit((event) => void actions.createToken(readFormField(event, 'label').trim())) } },
      h('label', { attrs: { for: 'token-label' } }, 'Token label'),
      h('input', { attrs: { id: 'token-label', name: 'label', type: 'text', required: '', autocomplete: 'off' } }),
      h('button', { attrs: { type: 'submit' } }, 'New token'),
    ),
  );

import { TTL_PRESETS_MINUTES } from '../../features/settings/ttl-presets.ts';
import type { Actions } from './actions.ts';
import { fileDropHandlers } from './file-drop-handlers.ts';
import type { H } from './h.ts';
import { onSubmit } from './on-submit.ts';
import { filePickerUnless, quickFields, quickSubmit } from './quick-fields.ts';
import { renderTtlChoices } from './render-ttl-choices.ts';

const LEAD = 'Paste a secret or attach a file, get a link that opens once. Nothing is stored and no account is needed.';

export type QuickStartProps = {
  readonly draft: string;
  readonly ttlMinutes: number;
  readonly file: File | undefined;
};

/* The front page (web-quick-start AC-1.1, secret-files AC-4.1): the draft and
   the chosen file come from the state, so a re-render keeps both. */
export const renderQuickStart = (h: H, actions: Actions, { draft, ttlMinutes, file }: QuickStartProps): HTMLElement =>
  h(
    'section',
    { attrs: { 'aria-labelledby': 'quick-heading' } },
    h('h2', { attrs: { id: 'quick-heading' } }, 'Quick start'),
    h('p', { attrs: { class: 'muted' } }, LEAD),
    h(
      'form',
      { attrs: { 'aria-labelledby': 'quick-heading' }, on: { submit: onSubmit(quickSubmit(actions, file)), ...fileDropHandlers(actions) } },
      ...quickFields(h, actions, draft, file),
      renderTtlChoices(h, { presets: TTL_PRESETS_MINUTES, current: ttlMinutes }),
      h('button', { attrs: { type: 'submit' } }, 'Get one-time link'),
      ...filePickerUnless(h, actions, file),
    ),
  );

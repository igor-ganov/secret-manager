import type { Actions } from './actions.ts';
import { fileDropHandlers } from './file-drop-handlers.ts';
import type { H } from './h.ts';
import { onSubmit } from './on-submit.ts';
import { filePickerUnless } from './quick-fields.ts';
import { shareFields, shareSubmit } from './share-fields.ts';

/* The signed-in share form: text (optionally saved under a key) or a file
   (secret-files AC-4.1), which takes the account's link lifetime. */
export const renderShareForm = (h: H, actions: Actions, file: File | undefined): HTMLElement =>
  h(
    'section',
    { attrs: { 'aria-labelledby': 'share-heading' } },
    h('h2', { attrs: { id: 'share-heading' } }, 'Share a secret'),
    h(
      'form',
      { attrs: { 'aria-labelledby': 'share-heading' }, on: { submit: onSubmit(shareSubmit(actions, file)), ...fileDropHandlers(actions) } },
      ...shareFields(h, actions, file),
      h('button', { attrs: { type: 'submit' } }, 'Get one-time link'),
      ...filePickerUnless(h, actions, file),
    ),
  );

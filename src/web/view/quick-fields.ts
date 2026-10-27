import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { readFormField } from './read-form-field.ts';
import { renderChosenFile } from './render-chosen-file.ts';
import { renderFilePicker } from './render-file-picker.ts';

const secretField = (h: H, draft: string): readonly Node[] => [
  h('label', { attrs: { for: 'quick-secret' } }, 'Secret'),
  h(
    'textarea',
    { attrs: { id: 'quick-secret', name: 'secret', required: '', autocomplete: 'off', spellcheck: 'false', 'data-autofocus': '' } },
    draft,
  ),
];

/* The text field, or the chosen file in its place. */
export const quickFields = (h: H, actions: Actions, draft: string, file: File | undefined): readonly Node[] => {
  switch (file) {
    case undefined:
      return secretField(h, draft);
    default:
      return renderChosenFile(h, actions, file);
  }
};

/* After the submit button, so the text flow keeps its tab order: the picker
   is the "or attach a file" alternative, gone once a file is chosen. */
export const filePickerUnless = (h: H, actions: Actions, file: File | undefined): readonly Node[] => {
  switch (file) {
    case undefined:
      return renderFilePicker(h, actions);
    default:
      return [];
  }
};

const ttlOf = (event: Event): number => Number(readFormField(event, 'ttl'));

/* Text goes out as a drop, a chosen file as a file drop; both with the lifetime. */
export const quickSubmit = (actions: Actions, file: File | undefined): ((event: Event) => void) => {
  switch (file) {
    case undefined:
      return (event) => void actions.drop(readFormField(event, 'secret'), ttlOf(event));
    default:
      return (event) => void actions.dropFile(file, ttlOf(event));
  }
};
